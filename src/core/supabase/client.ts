/**
 * Supabase client + anonymous session. Miflo has no login: a player is an
 * anonymous Supabase user (auth.uid()) backed by the persisted device identity.
 *
 * Nothing in the app talks to this directly except the rooms service
 * (src/core/rooms) — same boundary as the football fact layer. If the backend
 * isn't configured (empty keys in config.ts) `supabase` is null and the rooms
 * service stays in local/solo mode.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {SUPABASE_ANON_KEY, SUPABASE_URL, isBackendConfigured} from '../config';

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

/**
 * Ensure there's an anonymous session, signing in on first use. Safe to call
 * repeatedly (e.g. at app start and defensively before each room action) and a
 * no-op when the backend isn't configured. Returns the player's user id, or
 * null if unavailable.
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
  const {data, error} = await supabase.auth.signInAnonymously();
  if (error) {
    throw error;
  }
  return data.user?.id ?? null;
}
