/**
 * Move a profile to a new phone — client half of the device-linking handshake
 * (supabase/migrations/0032_device_transfers.sql + transfer-* Edge Functions).
 *
 * Miflo has no login: identity IS the anonymous session. The old phone is the
 * only device that can prove it owns the uid (it holds the session), so a move
 * is: the new phone asks with the owner's public friend code, the OLD phone
 * approves (the security gate) and hands over its session tokens plus a snapshot
 * of local-only state, and the new phone calls setSession(...) to BECOME the
 * same uid. Everything server-side stays valid — no re-keying.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import {clearSession} from '../identity/sessionVault';
import {BackendUnavailableError} from '../rooms/roomService';
import {ensureSession, supabase} from '../supabase/client';
import {fetchMyProfile} from '../social/socialService';
import {flushOutbox} from '../social/outbox';
import {syncPushToken} from '../notifications/pushInvites';
import {restoreLocal, snapshotLocal, type LocalSnapshot} from './transferPayload';

const LAST_UPLOADED_KEY = 'push.lastUploadedToken';

/** Local preferences kept when the old phone relinquishes (matches deleteAccount). */
const PREFS_KEPT = new Set(['app.language', 'app.haptics']);

type TransferPayload = {
  access_token: string;
  refresh_token: string;
  local: LocalSnapshot;
};

async function requireClient() {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  const uid = await ensureSession();
  if (!uid) {
    throw new BackendUnavailableError();
  }
  return {client: supabase, uid};
}

function lang(): 'da' | 'en' {
  return i18n.language?.startsWith('da') ? 'da' : 'en';
}

// ── New phone: ask, wait, redeem ───────────────────────────────────────────────

export type RequestOutcome =
  | {ok: true; transferId: string; matchCode: string}
  | {ok: false; reason: 'not_found' | 'self' | 'too_many' | 'error'};

/**
 * Ask the owner of `friendCode` to move their profile here. Files a pending
 * request and nudges their old phone; nothing moves until they approve. The
 * returned matchCode is shown here and on the old phone so they can confirm.
 */
export async function requestTransfer(friendCode: string): Promise<RequestOutcome> {
  const {client} = await requireClient();
  const {data, error} = await client.functions.invoke('transfer-request', {
    body: {friend_code: friendCode.trim().toUpperCase(), lang: lang()},
  });
  if (error) {
    return {ok: false, reason: 'error'};
  }
  const res = (data ?? {}) as {
    ok?: boolean;
    transferId?: string;
    matchCode?: string;
    reason?: string;
  };
  if (res.ok && res.transferId && res.matchCode) {
    return {ok: true, transferId: res.transferId, matchCode: res.matchCode};
  }
  if (res.reason === 'not_found' || res.reason === 'self' || res.reason === 'too_many') {
    return {ok: false, reason: res.reason};
  }
  return {ok: false, reason: 'error'};
}

export type TransferStatus = 'pending' | 'approved' | 'redeemed' | 'denied' | 'gone';

/** Poll one transfer's status (the new phone waiting, or the old phone after
 * approving). 'gone' means the row vanished (expired-and-swept or never seen). */
export async function pollTransferStatus(transferId: string): Promise<TransferStatus> {
  const {client} = await requireClient();
  const {data, error} = await client
    .from('device_transfers')
    .select('status')
    .eq('id', transferId)
    .maybeSingle();
  if (error || !data) {
    return 'gone';
  }
  return data.status as TransferStatus;
}

/**
 * Collect an approved handover and become the moved profile: setSession with the
 * old phone's tokens, restore the local snapshot, re-upload this device's push
 * token under the new uid, and refresh the profile cache. Returns false if the
 * transfer wasn't collectable (already redeemed, expired, denied).
 */
export async function redeemTransfer(transferId: string): Promise<boolean> {
  const {client} = await requireClient();
  const {data, error} = await client.functions.invoke('transfer-redeem', {
    body: {transfer_id: transferId},
  });
  if (error) {
    return false;
  }
  const res = (data ?? {}) as {ok?: boolean; payload?: TransferPayload};
  if (!res.ok || !res.payload?.access_token || !res.payload?.refresh_token) {
    return false;
  }
  await applyPayload(res.payload);
  return true;
}

async function applyPayload(payload: TransferPayload): Promise<void> {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  const {error} = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error) {
    throw error;
  }
  await restoreLocal(payload.local);
  // New device, new APNs token: drop the dedupe guard so it re-uploads under
  // the moved uid. Best-effort — the profile move already succeeded.
  await AsyncStorage.removeItem(LAST_UPLOADED_KEY).catch(() => {});
  syncPushToken().catch(() => {});
  await fetchMyProfile().catch(() => {});
}

// ── Old phone: see the request, approve/deny, relinquish ───────────────────────

export type PendingTransfer = {id: string; matchCode: string; expiresAt: string};

/** The newest live request to move THIS profile to another phone, or null. */
export async function fetchPendingTransfer(): Promise<PendingTransfer | null> {
  const {client, uid} = await requireClient();
  const {data, error} = await client
    .from('device_transfers')
    .select('id, match_code, expires_at')
    .eq('target_uid', uid)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', {ascending: false})
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {id: data.id, matchCode: data.match_code, expiresAt: data.expires_at};
}

/**
 * Approve a move: hand over this device's session tokens plus a snapshot of the
 * local-only daily state. The old phone does NOT relinquish here — it keeps its
 * session until the new phone has actually redeemed (awaitRelinquish), so a new
 * phone that never collects leaves the profile safely on the old phone.
 */
export async function approveTransfer(transferId: string): Promise<boolean> {
  const {client} = await requireClient();
  // Publish anything still queued so it isn't stranded (the uid is unchanged,
  // so these publish normally). Best-effort.
  await flushOutbox().catch(() => {});

  const {
    data: {session},
  } = await client.auth.getSession();
  if (!session?.access_token || !session?.refresh_token) {
    return false;
  }
  const local = await snapshotLocal();
  const {data, error} = await client.functions.invoke('transfer-approve', {
    body: {
      transfer_id: transferId,
      payload: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        local,
      },
    },
  });
  if (error) {
    return false;
  }
  return Boolean((data as {ok?: boolean})?.ok);
}

/** Decline a move (pure status flip RPC). The new phone, polling, sees 'denied'. */
export async function denyTransfer(transferId: string): Promise<void> {
  try {
    const {client} = await requireClient();
    await client.rpc('deny_device_transfer', {p_id: transferId});
  } catch {
    // Best-effort: an un-denied request just expires on its own.
  }
}

/**
 * After approving, wait for the new phone to redeem, then relinquish: this phone
 * signs out (dropping the now-shared session) and wipes local user data so it
 * returns to first run. Resolves true once relinquished, false if the transfer
 * expired/failed without ever being redeemed (this phone keeps the profile).
 */
export async function awaitRelinquish(
  transferId: string,
  timeoutMs = 12 * 60_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await pollTransferStatus(transferId);
    if (status === 'redeemed') {
      await relinquishLocal();
      return true;
    }
    if (status === 'denied' || status === 'gone') {
      return false;
    }
    await new Promise<void>(resolve => setTimeout(() => resolve(), 2500));
  }
  return false;
}

/** Sign out and wipe local user data — the profile now lives on the new phone. */
async function relinquishLocal(): Promise<void> {
  // Forget the identity anchor first: the new phone owns this uid now, so the
  // old phone must not "recover" it on its next launch (the Keychain vault
  // otherwise outlives even a reinstall).
  await clearSession();
  if (supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k => !PREFS_KEPT.has(k));
    await Promise.all(toRemove.map(k => AsyncStorage.removeItem(k)));
  } catch {
    // Local reset only — the handover already succeeded server-side.
  }
}
