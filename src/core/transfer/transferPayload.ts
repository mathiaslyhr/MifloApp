/**
 * The local-only slice of a profile that must ride along when it moves to a new
 * phone. Identity (the anonymous session) moves via setSession, and everything
 * server-side (profile, friends, results, favorites) is keyed to the uid and
 * simply stays valid — but the four daily games keep their authoritative streaks
 * and Log history in device-global AsyncStorage keys that aren't derived from
 * the uid, so without this snapshot they'd be lost on the new phone.
 *
 * Deliberately excluded:
 *   - the supabase auth-token key (moved by setSession, not restored here)
 *   - `social.profile` (re-fetched fresh from the server for the moved uid)
 *   - `social.outbox` (flushed before the move; never carried)
 *   - `push.lastUploadedToken` + `miflo.deviceId` (device-specific)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TRANSFER_KEYS = [
  'mystery.progress', 'mystery.streak', 'mystery.history',
  'tenball.progress', 'tenball.streak', 'tenball.history',
  'teamsheet.progress', 'teamsheet.streak', 'teamsheet.history',
  'journeyman.progress', 'journeyman.streak', 'journeyman.history',
  'app.skin', 'app.haptics', 'app.scoutReminder', 'app.scoutReminderAsked',
  'social.backfilled',
  'miflo.nickname',
] as const;

export type LocalSnapshot = Record<string, string>;

/** Read every present transfer key into a plain string map (skips absent keys). */
export async function snapshotLocal(): Promise<LocalSnapshot> {
  const snap: LocalSnapshot = {};
  await Promise.all(
    TRANSFER_KEYS.map(async key => {
      const value = await AsyncStorage.getItem(key);
      if (value != null) {
        snap[key] = value;
      }
    }),
  );
  return snap;
}

/** Write a snapshot back, ignoring any key not on the allowlist (defensive). */
export async function restoreLocal(snap: LocalSnapshot | null | undefined): Promise<void> {
  if (!snap) {
    return;
  }
  const allowed = new Set<string>(TRANSFER_KEYS as readonly string[]);
  await Promise.all(
    Object.entries(snap)
      .filter(([key]) => allowed.has(key))
      .map(([key, value]) => AsyncStorage.setItem(key, value)),
  );
}
