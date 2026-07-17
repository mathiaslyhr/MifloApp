/**
 * The durable identity vault. Miflo has no login — a player IS an anonymous
 * Supabase session (auth.uid()). Supabase persists that session in AsyncStorage,
 * but it also *clears* it on certain refresh-token failures (rotation/reuse
 * race, a blip mid-refresh), and a fresh install wipes AsyncStorage entirely.
 * Either way the app used to silently mint a brand-new uid and orphan the
 * profile (a friend "got logged out" and had to remake his profile).
 *
 * This vault is the anchor that prevents that. It keeps the latest refresh
 * token in the iOS Keychain — storage supabase-js does NOT manage (so it can't
 * wipe our recovery anchor when it drops a dead session) and which *survives a
 * reinstall*. ensureSession() uses it to restore the SAME uid via setSession
 * instead of forking a new identity. It is cleared only on deliberate teardown
 * (delete profile / hand a profile to a new phone).
 */
import * as Keychain from 'react-native-keychain';

/** The single Keychain service holding the identity anchor. */
const SERVICE = 'dk.miflo.identity';

export type VaultSession = {
  refreshToken: string;
  uid: string;
};

/**
 * Persist the latest refresh token + uid. Called from the auth listener on
 * every SIGNED_IN / TOKEN_REFRESHED, so the anchor always holds the *current*
 * (rotated) refresh token. Best-effort: a Keychain write failure must never
 * break a token refresh, so callers fire-and-forget.
 */
export async function saveSession(session: VaultSession): Promise<void> {
  try {
    await Keychain.setGenericPassword(session.uid, session.refreshToken, {
      service: SERVICE,
      // Available after the first unlock so background token refresh works and
      // no biometric prompt ever appears.
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
  } catch {
    // Anchor is a backup — the live session in AsyncStorage still works.
  }
}

/** The stored identity anchor, or null if this device has never established one. */
export async function readSession(): Promise<VaultSession | null> {
  try {
    const creds = await Keychain.getGenericPassword({service: SERVICE});
    if (!creds || !creds.password || !creds.username) {
      return null;
    }
    return {uid: creds.username, refreshToken: creds.password};
  } catch {
    return null;
  }
}

/**
 * Forget the identity anchor. Only the deliberate teardown paths call this
 * (deleteAccount, the old phone relinquishing after a transfer) — never the
 * auth listener, because supabase fires SIGNED_OUT on involuntary drops too and
 * erasing the anchor there is exactly the loss we're preventing.
 */
export async function clearSession(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: SERVICE});
  } catch {
    // Best-effort: a stale anchor is harmless — recovery only ever restores a
    // uid the server still honours.
  }
}
