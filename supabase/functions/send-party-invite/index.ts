// Party invite → APNs push.
//
// The host taps a friend in the invite sheet; the app calls this function
// with the friend's user id and the room code. We verify server-side that the
// caller and the friend are actually friends, that the room exists and is
// still in the lobby with the caller in it, then push "X invited you to a
// party" straight to the friend's iPhone. The push payload carries the room
// code; tapping it deep-links into the Join screen which auto-joins.
//
// Invoked with the caller's anonymous JWT (verify_jwt stays on). Tokens are
// unreadable by clients (no select policy on push_tokens); only this function
// touches them, via the service role.
//
// Expected failures come back as 200 {ok:false, reason} so the app can react
// without functions.invoke throwing: 'no_token' | 'not_friends' | 'no_room' |
// 'apns_failed'.
//
// Deploy:  supabase functions deploy send-party-invite
// Secrets: shared APNS_* — see _shared/apns.ts.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {apnsConfigured, sendApnsAlert} from '../_shared/apns.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// A lobby invite is worthless once the party has started or died.
const EXPIRY_SECONDS = 600;

// Sender-language copy, composed here so the client never supplies free text.
// Static type-label title (long names truncate on the lock screen and hide
// what the push is); the host's name lives in the body.
const COPY = {
  en: {
    title: () => 'Match invite',
    body: (name: string) => `${name} invited you. Tap to join their match.`,
  },
  da: {
    title: () => 'Kampinvitation',
    body: (name: string) => `${name} har inviteret dig. Tryk for at deltage i kampen.`,
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
  if (!apnsConfigured()) {
    return json(500, {error: 'APNs secrets not set'});
  }

  let body: {friendUserId?: string; code?: string; lang?: string};
  try {
    body = await req.json();
  } catch {
    return json(400, {error: 'Invalid JSON'});
  }

  const friendUserId = (body.friendUserId ?? '').trim();
  const code = (body.code ?? '').trim().toUpperCase();
  const copy = COPY[body.lang === 'da' ? 'da' : 'en'];
  if (!/^[0-9a-f-]{36}$/i.test(friendUserId) || !/^[A-Z0-9]{4}$/.test(code)) {
    return json(400, {error: 'Bad request'});
  }

  // Who is calling? verify_jwt already checked the signature; this resolves
  // the uid so every check below is keyed to the real caller.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: {headers: {Authorization: req.headers.get('Authorization') ?? ''}},
  });
  const {data: userData, error: userError} = await asCaller.auth.getUser();
  const callerId = userData?.user?.id;
  if (userError || !callerId) {
    return json(401, {error: 'Not signed in'});
  }
  if (callerId === friendUserId) {
    return json(400, {error: 'Bad request'});
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Friendship is the authorization: you can only push to mutual friends.
  const [userA, userB] =
    callerId < friendUserId ? [callerId, friendUserId] : [friendUserId, callerId];
  const {data: friendship} = await admin
    .from('friendships')
    .select('user_a')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle();
  if (!friendship) {
    return json(200, {ok: false, reason: 'not_friends'});
  }

  // The party must still be joinable and the caller must actually be in it.
  const {data: room} = await admin
    .from('rooms')
    .select('id, status')
    .eq('code', code)
    .maybeSingle();
  if (!room || room.status !== 'lobby') {
    return json(200, {ok: false, reason: 'no_room'});
  }
  const {data: membership} = await admin
    .from('players')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', callerId)
    .maybeSingle();
  if (!membership) {
    return json(200, {ok: false, reason: 'no_room'});
  }

  const {data: profile} = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', callerId)
    .maybeSingle();
  const hostName = profile?.display_name ?? 'A friend';

  const {data: tokenRow} = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', friendUserId)
    .maybeSingle();
  if (!tokenRow) {
    return json(200, {ok: false, reason: 'no_token'});
  }

  const payload = {
    aps: {
      alert: {title: copy.title(), body: copy.body(hostName)},
      sound: 'default',
    },
    // Top-level routing fields feed notifee's non-notifee fallback parser
    // (taps on banners delivered while the app was closed).
    type: 'party-invite',
    code,
    // Notifee's willPresent only shows foreground banners for notifications
    // carrying its own userInfo key — `notifee_options` is translated into it
    // by a Notification Service Extension, which this app doesn't have, so we
    // write the final key directly. `data` must repeat the routing fields:
    // when this key exists, notifee hands exactly this object to the JS press
    // handler instead of parsing the userInfo.
    __notifee_notification: {
      id: crypto.randomUUID(),
      data: {type: 'party-invite', code},
      ios: {foregroundPresentationOptions: {banner: true, sound: true, list: true}},
    },
  };

  const result = await sendApnsAlert(tokenRow.token, payload, EXPIRY_SECONDS);
  if (result.ok) {
    return json(200, {ok: true});
  }

  // Apple says this token will never work again: drop it so the friend shows
  // as unreachable instead of silently failing forever.
  if (result.pruneToken) {
    await admin.from('push_tokens').delete().eq('user_id', friendUserId);
    return json(200, {ok: false, reason: 'no_token'});
  }

  console.error('APNs send failed', result.status, result.reason);
  return json(200, {ok: false, reason: 'apns_failed'});
});
