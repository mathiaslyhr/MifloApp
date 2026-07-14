// Move profile to a new phone — step 1: the new phone asks.
//
// The new phone (a fresh anonymous uid) types the profile owner's PUBLIC friend
// code. We resolve the code to its owner (target_uid), file a short-lived
// pending device_transfers row, and best-effort push the owner's OLD phone to
// come approve. Nothing moves yet — approval on the old phone is the real gate
// (transfer-approve), because a friend code is public and can't authorize a
// takeover on its own.
//
// Returns { transferId, matchCode }. The matchCode is shown on BOTH screens so
// the owner can confirm the request is really from the phone in their hand.
// Idempotent: an existing live request from the same new phone to the same
// owner is returned as-is rather than piling up rows.
//
// Invoked with the new phone's anonymous JWT (verify_jwt stays on).
//
// Deploy:  supabase functions deploy transfer-request
// Secrets: shared APNS_* (for the nudge) — see _shared/apns.ts.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {apnsConfigured, sendApnsAlert} from '../_shared/apns.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// A transfer is a live, foreground handshake — 10 minutes is plenty and keeps
// the window a stolen match code could be useful tiny.
const TTL_MINUTES = 10;
const PUSH_EXPIRY_SECONDS = TTL_MINUTES * 60;

// Backstop against someone hammering an owner's public code to spam approval
// prompts. More than a handful of live requests at once is not a real transfer.
const MAX_LIVE_PER_TARGET = 5;

// Same unambiguous alphabet as friend codes (no 0/O/1/I). 4 chars is enough to
// disambiguate a request the owner is looking at right now.
const MATCH_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genMatchCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, b => MATCH_ALPHABET[b % MATCH_ALPHABET.length]).join('');
}

const COPY = {
  en: {
    title: 'Move to a new phone',
    body: (name: string) => `${name}, approve moving your profile to a new phone.`,
  },
  da: {
    title: 'Skift til ny telefon',
    body: (name: string) => `${name}, godkend at flytte din profil til en ny telefon.`,
  },
} as const;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {...cors, 'Content-Type': 'application/json'},
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: cors});
  }

  let body: {friend_code?: string; lang?: string};
  try {
    body = await req.json();
  } catch {
    return json(400, {error: 'Invalid JSON'});
  }

  const code = (body.friend_code ?? '').trim().toUpperCase();
  const lang = body.lang === 'da' ? 'da' : 'en';
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    return json(400, {error: 'Bad request'});
  }

  // Who is asking? verify_jwt checked the signature; resolve the caller's uid.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: {headers: {Authorization: req.headers.get('Authorization') ?? ''}},
  });
  const {data: userData, error: userError} = await asCaller.auth.getUser();
  const newUid = userData?.user?.id;
  if (userError || !newUid) {
    return json(401, {error: 'Not signed in'});
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const {data: owner} = await admin
    .from('profiles')
    .select('user_id, display_name')
    .eq('friend_code', code)
    .maybeSingle();
  if (!owner) {
    return json(200, {ok: false, reason: 'not_found'});
  }
  const targetUid = owner.user_id as string;
  if (targetUid === newUid) {
    // The new phone typed its own code — it already IS this profile.
    return json(200, {ok: false, reason: 'self'});
  }

  const nowIso = new Date().toISOString();

  // Reuse a still-live request from this same new phone rather than stacking.
  const {data: existing} = await admin
    .from('device_transfers')
    .select('id, match_code')
    .eq('target_uid', targetUid)
    .eq('new_uid', newUid)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (existing) {
    return json(200, {ok: true, transferId: existing.id, matchCode: existing.match_code});
  }

  const {count: liveCount} = await admin
    .from('device_transfers')
    .select('id', {count: 'exact', head: true})
    .eq('target_uid', targetUid)
    .eq('status', 'pending')
    .gt('expires_at', nowIso);
  if ((liveCount ?? 0) >= MAX_LIVE_PER_TARGET) {
    return json(200, {ok: false, reason: 'too_many'});
  }

  const matchCode = genMatchCode();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();
  const {data: inserted, error: insertError} = await admin
    .from('device_transfers')
    .insert({
      target_uid: targetUid,
      new_uid: newUid,
      match_code: matchCode,
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.error('transfer insert failed', insertError);
    return json(500, {error: 'Could not create transfer'});
  }

  // Best-effort nudge: ring the owner's old phone so they come and approve.
  // The old phone also polls, so a missing/failed push is harmless.
  if (apnsConfigured()) {
    const {data: tokenRow} = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', targetUid)
      .maybeSingle();
    if (tokenRow) {
      const copy = COPY[lang];
      const payload = {
        aps: {
          alert: {title: copy.title, body: copy.body(owner.display_name ?? '')},
          sound: 'default',
        },
        type: 'device-transfer',
        __notifee_notification: {
          id: crypto.randomUUID(),
          data: {type: 'device-transfer'},
          ios: {foregroundPresentationOptions: {banner: true, sound: true, list: true}},
        },
      };
      await sendApnsAlert(tokenRow.token, payload, PUSH_EXPIRY_SECONDS).catch(() => {});
    }
  }

  return json(200, {ok: true, transferId: inserted.id, matchCode});
});
