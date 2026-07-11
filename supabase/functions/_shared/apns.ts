// Shared APNs plumbing for every push-sending Edge Function
// (send-party-invite, send-friend-push). One place owns the provider JWT,
// the HTTP/2 send, and the sandbox/production fallback dance.
//
// Secrets (set once, shared by all functions):
//   supabase secrets set APNS_KEY_ID=…    (from the .p8 key)
//   supabase secrets set APNS_TEAM_ID=…   (Apple Developer team)
//   supabase secrets set APNS_TOPIC=com.mathiaslyhr.miflo
//   supabase secrets set APNS_ENV=sandbox|production
//   supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_XXX.p8)"

import {importPKCS8, SignJWT} from 'npm:jose@5';

const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') ?? '';
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? '';
const APNS_TOPIC = Deno.env.get('APNS_TOPIC') ?? 'com.mathiaslyhr.miflo';
const APNS_ENV = Deno.env.get('APNS_ENV') ?? 'production';
// Secrets set from a file keep real newlines; pasted ones often arrive \n-escaped.
const APNS_PRIVATE_KEY = (Deno.env.get('APNS_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');

const HOSTS = {
  production: 'api.push.apple.com',
  sandbox: 'api.sandbox.push.apple.com',
} as const;

/** False when the APNS_* secrets aren't set — callers should 500 early. */
export function apnsConfigured(): boolean {
  return Boolean(APNS_KEY_ID && APNS_TEAM_ID && APNS_PRIVATE_KEY);
}

// APNs provider JWTs may be reused for 20–60 minutes; cache per warm instance.
let cachedJwt: {value: string; issuedAt: number} | null = null;

async function apnsJwt(): Promise<string> {
  const now = Date.now();
  if (cachedJwt && now - cachedJwt.issuedAt < 45 * 60 * 1000) {
    return cachedJwt.value;
  }
  const key = await importPKCS8(APNS_PRIVATE_KEY, 'ES256');
  const value = await new SignJWT({})
    .setProtectedHeader({alg: 'ES256', kid: APNS_KEY_ID})
    .setIssuer(APNS_TEAM_ID)
    .setIssuedAt()
    .sign(key);
  cachedJwt = {value, issuedAt: now};
  return value;
}

async function pushTo(
  host: string,
  token: string,
  payload: unknown,
  expirySeconds: number,
): Promise<{status: number; reason: string}> {
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await apnsJwt()}`,
      'apns-topic': APNS_TOPIC,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + expirySeconds),
    },
    body: JSON.stringify(payload),
  });
  let reason = '';
  if (!res.ok) {
    try {
      reason = ((await res.json()) as {reason?: string}).reason ?? '';
    } catch {
      // ignore: status alone is enough to act on
    }
  } else {
    await res.body?.cancel();
  }
  return {status: res.status, reason};
}

export type ApnsResult = {
  /** The push reached Apple and was accepted. */
  ok: boolean;
  /** Apple says this token will never work again — delete its row. */
  pruneToken: boolean;
  status: number;
  reason: string;
};

/**
 * Send one alert push, trying the configured environment first and, on
 * BadDeviceToken, the other one — Xcode-installed builds carry sandbox
 * tokens, TestFlight/App Store builds production ones, and one APNS_ENV
 * secret has to serve both flavors.
 */
export async function sendApnsAlert(
  token: string,
  payload: unknown,
  expirySeconds: number,
): Promise<ApnsResult> {
  const primary = HOSTS[APNS_ENV === 'sandbox' ? 'sandbox' : 'production'];
  const secondary = primary === HOSTS.sandbox ? HOSTS.production : HOSTS.sandbox;

  let result = await pushTo(primary, token, payload, expirySeconds);
  if (result.status === 400 && result.reason === 'BadDeviceToken') {
    result = await pushTo(secondary, token, payload, expirySeconds);
  }

  // 410 Unregistered (app deleted, permission revoked at the OS level) or a
  // token both environments reject: it will never work again.
  const pruneToken =
    result.status === 410 ||
    (result.status === 400 && result.reason === 'BadDeviceToken');

  return {ok: result.status === 200, pruneToken, ...result};
}
