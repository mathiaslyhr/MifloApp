// Move profile to a new phone — step 3: the new phone collects the handover.
//
// Once the old phone has approved, the new phone redeems the encrypted payload
// here. The JWT check pins redemption to the row's new_uid, so ONLY the device
// that made the request (and holds that anonymous session) can collect it — the
// payload never rides back over PostgREST (the payload column isn't even
// granted to clients). Single use: we atomically flip 'approved' -> 'redeemed'
// and only return the payload if this call is the one that won that flip.
//
// Returns { ok, payload: { access_token, refresh_token, local } }. The new phone
// calls supabase.auth.setSession(...) with the tokens and restores `local`.
//
// Invoked with the NEW phone's anonymous JWT (verify_jwt stays on).
//
// Deploy:  supabase functions deploy transfer-redeem
// Secrets: TRANSFER_ENC_KEY — see _shared/transferCrypto.ts.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {decryptPayload, transferCryptoConfigured} from '../_shared/transferCrypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
  if (!transferCryptoConfigured()) {
    return json(500, {error: 'TRANSFER_ENC_KEY not set'});
  }

  let body: {transfer_id?: string};
  try {
    body = await req.json();
  } catch {
    return json(400, {error: 'Invalid JSON'});
  }

  const transferId = (body.transfer_id ?? '').toString().trim();
  if (!/^[0-9a-f-]{36}$/i.test(transferId)) {
    return json(400, {error: 'Bad request'});
  }

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: {headers: {Authorization: req.headers.get('Authorization') ?? ''}},
  });
  const {data: userData, error: userError} = await asCaller.auth.getUser();
  const callerId = userData?.user?.id;
  if (userError || !callerId) {
    return json(401, {error: 'Not signed in'});
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const {data: row} = await admin
    .from('device_transfers')
    .select('id, new_uid, status, payload, expires_at')
    .eq('id', transferId)
    .maybeSingle();
  if (!row || row.new_uid !== callerId) {
    return json(200, {ok: false, reason: 'not_found'});
  }
  if (row.status === 'redeemed') {
    return json(200, {ok: false, reason: 'already_redeemed'});
  }
  if (row.status !== 'approved' || !row.payload) {
    return json(200, {ok: false, reason: 'not_approved'});
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return json(200, {ok: false, reason: 'expired'});
  }

  // Claim it: only the caller that flips approved -> redeemed gets the payload.
  const {data: claimed} = await admin
    .from('device_transfers')
    .update({status: 'redeemed', redeemed_at: new Date().toISOString(), payload: null})
    .eq('id', transferId)
    .eq('status', 'approved')
    .select('id')
    .maybeSingle();
  if (!claimed) {
    return json(200, {ok: false, reason: 'already_redeemed'});
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await decryptPayload(row.payload));
  } catch (err) {
    console.error('transfer decrypt failed', err);
    return json(500, {error: 'Corrupt payload'});
  }

  return json(200, {ok: true, payload});
});
