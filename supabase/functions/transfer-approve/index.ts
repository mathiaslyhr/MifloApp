// Move profile to a new phone — step 2: the OLD phone approves.
//
// The owner, on their old phone, taps Approve. Only the old phone can do this:
// it holds the anonymous session, so it is the sole device that can prove it
// owns the uid AND produce the tokens the new phone needs. It sends the pending
// row's id plus the handover payload:
//   { access_token, refresh_token, local: { …AsyncStorage snapshot… } }
// We verify the caller really is the row's target_uid, encrypt the payload at
// rest, and flip the row to 'approved'. The new phone then collects it via
// transfer-redeem and calls setSession(...), becoming the same uid.
//
// Invoked with the OLD phone's anonymous JWT (verify_jwt stays on).
//
// Deploy:  supabase functions deploy transfer-approve
// Secrets: TRANSFER_ENC_KEY — see _shared/transferCrypto.ts.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {encryptPayload, transferCryptoConfigured} from '../_shared/transferCrypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// The payload is tokens + a snapshot of four small daily logs; a quarter MB is
// already generous and caps abuse.
const MAX_PAYLOAD_CHARS = 262_144;

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

  let body: {transfer_id?: string; payload?: unknown};
  try {
    body = await req.json();
  } catch {
    return json(400, {error: 'Invalid JSON'});
  }

  const transferId = (body.transfer_id ?? '').toString().trim();
  const plaintext = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload);
  if (!/^[0-9a-f-]{36}$/i.test(transferId) || !plaintext || plaintext.length > MAX_PAYLOAD_CHARS) {
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
    .select('id, target_uid, status, expires_at')
    .eq('id', transferId)
    .maybeSingle();
  if (!row || row.target_uid !== callerId) {
    // Not the owner of this row (or no such row) — never reveal which.
    return json(200, {ok: false, reason: 'not_found'});
  }
  if (row.status !== 'pending') {
    return json(200, {ok: false, reason: 'not_pending'});
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return json(200, {ok: false, reason: 'expired'});
  }

  const encrypted = await encryptPayload(plaintext);
  // Guarded update: only flip a row that is still pending, so a double-approve
  // or a race can't clobber an already-redeemed handover.
  const {data: updated, error: updateError} = await admin
    .from('device_transfers')
    .update({status: 'approved', payload: encrypted})
    .eq('id', transferId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (updateError) {
    console.error('transfer approve failed', updateError);
    return json(500, {error: 'Could not approve'});
  }
  if (!updated) {
    return json(200, {ok: false, reason: 'not_pending'});
  }

  return json(200, {ok: true});
});
