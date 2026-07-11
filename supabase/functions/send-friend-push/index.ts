// Friend-request lifecycle → APNs push.
//
// Two pushes, both invoked by the app right after the matching RPC succeeds
// (fire-and-forget; the Requests section is the source of truth, the push is
// just the doorbell):
//   kind 'friend_request'   → to the addressee: "X wants to be friends"
//   kind 'request_accepted' → to the original requester: "X accepted…"
//
// The caller can't lie about state: we verify against the database, not the
// request body. A 'friend_request' push requires a live friend_requests row
// (caller → target); a 'request_accepted' push requires the friendship row to
// actually exist. Worst case a malicious client re-sends a truthful
// notification.
//
// Invoked with the caller's anonymous JWT (verify_jwt stays on). Tokens are
// unreadable by clients; only Edge Functions read push_tokens via the
// service role.
//
// Expected failures come back as 200 {ok:false, reason} so the app can react
// without functions.invoke throwing: 'no_token' | 'not_allowed' |
// 'apns_failed'.
//
// Deploy:  supabase functions deploy send-friend-push
// Secrets: shared APNS_* — see _shared/apns.ts.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {apnsConfigured, sendApnsAlert} from '../_shared/apns.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// A friend request stays relevant for a while (unlike a 10-minute lobby):
// let Apple retry delivery for a day if the phone is offline.
const EXPIRY_SECONDS = 24 * 60 * 60;

// Sender-language copy, composed here so the client never supplies free text.
// (No loc-keys: the app has no bundle Localizable.strings — i18n is JS-side.)
// Titles are static type labels ("Friend request") — a long sender name in
// the title truncates on the lock screen and hides what the push even is;
// the name lives in the body instead.
const COPY = {
  en: {
    friend_request: (name: string) => ({
      title: 'Friend request',
      body: `${name} wants to be friends. Open Miflo to accept.`,
    }),
    request_accepted: (name: string) => ({
      title: 'Friend request accepted',
      body: `${name} accepted your request.`,
    }),
  },
  da: {
    friend_request: (name: string) => ({
      title: 'Venneanmodning',
      body: `${name} vil være venner. Åbn Miflo for at acceptere.`,
    }),
    request_accepted: (name: string) => ({
      title: 'Venneanmodning accepteret',
      body: `${name} har accepteret din anmodning.`,
    }),
  },
} as const;

type Kind = 'friend_request' | 'request_accepted';

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

  let body: {kind?: string; toUserId?: string; lang?: string};
  try {
    body = await req.json();
  } catch {
    return json(400, {error: 'Invalid JSON'});
  }

  const kind = body.kind as Kind;
  const toUserId = (body.toUserId ?? '').trim();
  const lang = body.lang === 'da' ? 'da' : 'en';
  if (
    (kind !== 'friend_request' && kind !== 'request_accepted') ||
    !/^[0-9a-f-]{36}$/i.test(toUserId)
  ) {
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
  if (callerId === toUserId) {
    return json(400, {error: 'Bad request'});
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Verify the claimed state actually holds in the database.
  if (kind === 'friend_request') {
    const {data: request} = await admin
      .from('friend_requests')
      .select('requester')
      .eq('requester', callerId)
      .eq('addressee', toUserId)
      .maybeSingle();
    if (!request) {
      return json(200, {ok: false, reason: 'not_allowed'});
    }
  } else {
    const [userA, userB] =
      callerId < toUserId ? [callerId, toUserId] : [toUserId, callerId];
    const {data: friendship} = await admin
      .from('friendships')
      .select('user_a')
      .eq('user_a', userA)
      .eq('user_b', userB)
      .maybeSingle();
    if (!friendship) {
      return json(200, {ok: false, reason: 'not_allowed'});
    }
  }

  const {data: profile} = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', callerId)
    .maybeSingle();
  const callerName = profile?.display_name ?? 'A friend';

  const {data: tokenRow} = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', toUserId)
    .maybeSingle();
  if (!tokenRow) {
    return json(200, {ok: false, reason: 'no_token'});
  }

  const alert = COPY[lang][kind](callerName);
  const type = kind === 'friend_request' ? 'friend-request' : 'friend-accepted';
  const payload = {
    aps: {alert, sound: 'default'},
    // The app routes both types to the Friends tab (pushInvites.ts). The
    // top-level copy feeds notifee's non-notifee fallback parser (taps on
    // banners delivered while the app was closed).
    type,
    // Notifee's willPresent only shows foreground banners for notifications
    // carrying its own userInfo key — `notifee_options` is translated into it
    // by a Notification Service Extension, which this app doesn't have, so we
    // write the final key directly. `data` must repeat the routing fields:
    // when this key exists, notifee hands exactly this object to the JS press
    // handler instead of parsing the userInfo.
    __notifee_notification: {
      id: crypto.randomUUID(),
      data: {type},
      ios: {foregroundPresentationOptions: {banner: true, sound: true, list: true}},
    },
  };

  const result = await sendApnsAlert(tokenRow.token, payload, EXPIRY_SECONDS);
  if (result.ok) {
    return json(200, {ok: true});
  }

  // Apple says this token will never work again: drop it so future sends
  // report 'no_token' instead of silently failing forever.
  if (result.pruneToken) {
    await admin.from('push_tokens').delete().eq('user_id', toUserId);
    return json(200, {ok: false, reason: 'no_token'});
  }

  console.error('APNs send failed', result.status, result.reason);
  return json(200, {ok: false, reason: 'apns_failed'});
});
