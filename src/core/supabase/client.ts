/**
 * Supabase client + anonymous session. Miflo has no login: a player is an
 * anonymous Supabase user (auth.uid()) backed by the persisted device identity.
 *
 * Nothing in the app talks to this directly except the rooms service
 * (src/core/rooms) — same boundary as the football fact layer. If the backend
 * isn't configured (empty keys in config.ts) `supabase` is null and the rooms
 * service stays in local/solo mode.
 *
 * Identity durability: supabase persists the session in AsyncStorage but can
 * clear it on a refresh-token failure, and a reinstall wipes it entirely. To
 * stop that from silently forking a brand-new uid (and orphaning the profile),
 * the latest refresh token is mirrored into the Keychain vault
 * (core/identity/sessionVault) and ensureSession() recovers from it before it
 * ever mints a new identity.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {SUPABASE_ANON_KEY, SUPABASE_URL, isBackendConfigured} from '../config';
import {readSession, saveSession} from '../identity/sessionVault';

export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // No URL-based auth callbacks in a React Native app.
        detectSessionInUrl: false,
      },
    })
  : null;

// Mirror every live/refreshed session into the Keychain vault. This fires on
// SIGNED_IN and on every TOKEN_REFRESHED, so the anchor always holds the
// *current* rotated refresh token. We deliberately do nothing on SIGNED_OUT:
// supabase fires it on involuntary drops too, and erasing the anchor there is
// exactly the identity loss this whole change prevents — the vault is cleared
// only by the deliberate teardown paths (deleteAccount / transfer relinquish).
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.refresh_token && session.user?.id) {
      saveSession({
        refreshToken: session.refresh_token,
        uid: session.user.id,
      }).catch(() => {});
    }
  });
}

/**
 * Ensure there's an anonymous session, returning the player's user id (or null
 * when the backend isn't configured). Safe to call repeatedly.
 *
 * The order matters — it's what keeps a transient token loss from becoming a
 * new identity:
 *   1. A live session → return its uid.
 *   2. No live session but the Keychain vault holds a refresh token → restore
 *      the SAME uid via setSession. This covers both supabase clearing a session
 *      on a refresh blip and a fresh reinstall (the Keychain survives it).
 *   3. Vault empty → genuine first run → sign in anonymously once.
 *   4. Vault present but recovery failed (a truly dead refresh token) → do NOT
 *      sign in anonymously. Return null so callers stay in cached/offline mode;
 *      the app must never silently fork a new profile over an unreachable one.
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  const {
    data: {session},
  } = await supabase.auth.getSession();
  if (session) {
    return session.user.id;
  }

  // No live session. Before minting anything new, try to restore the real one
  // from the durable anchor.
  const anchor = await readSession();
  if (anchor?.refreshToken) {
    // Redeem the anchored refresh token for a fresh access+refresh pair.
    // refreshSession (not setSession with an empty access_token) is what yields
    // a real authenticated session, so the recovered session actually carries a
    // valid user JWT — without it, Storage/RPC calls go out with auth.uid() NULL
    // and RLS rejects every authenticated write (e.g. the avatars upload 403s).
    const {data, error} = await supabase.auth.refreshSession({
      refresh_token: anchor.refreshToken,
    });
    if (!error && data.session) {
      return data.session.user.id;
    }
    // The anchor exists but couldn't be redeemed (dead/revoked token). We had an
    // identity, so refuse to fork a new one — fail closed instead.
    return null;
  }

  // Genuine first run: no live session and nothing ever anchored.
  const {data, error} = await supabase.auth.signInAnonymously();
  if (error) {
    throw error;
  }
  return data.user?.id ?? null;
}
