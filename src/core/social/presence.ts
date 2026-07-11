/**
 * Friends presence: the app heartbeats "I'm here" while foregrounded, and the
 * Friends tab turns each friend's `last_seen_at` into a green "online" dot or
 * an "Active 14 min ago" caption. Same shape as the host-liveness heartbeat
 * (src/core/rooms/liveness.ts): an interval plus an immediate beat whenever
 * the app returns to the foreground — iOS suspends JS timers in the
 * background, which is exactly what makes an away player read as away.
 */
import {AppState} from 'react-native';
import {isBackendConfigured} from '../config';
import {getCachedProfile, touchPresence} from './socialService';

/** Ping cadence while foregrounded. */
export const PRESENCE_HEARTBEAT_MS = 120_000;

/**
 * "Online" = last heartbeat under this. Holds one dropped beat of margin over
 * the cadence (and 0020_social.sql documents the pairing; change together).
 */
export const ONLINE_WINDOW_MS = 180_000;

/** Older than this and the card shows no activity line at all. */
export const MAX_ACTIVE_AGE_MIN = 7 * 24 * 60;

export type Presence = {
  online: boolean;
  /** Whole minutes since last seen (>= 1), or null when unknown/online. */
  minutesAgo: number | null;
};

/**
 * Pure read of a friend's presence at `nowMs`. A timestamp slightly in the
 * future (clock skew — the server stamps, the device compares) counts as
 * online rather than flickering off.
 */
export function presenceFor(lastSeenAt: string | null | undefined, nowMs: number): Presence {
  if (!lastSeenAt) {
    return {online: false, minutesAgo: null};
  }
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) {
    return {online: false, minutesAgo: null};
  }
  const age = nowMs - seen;
  if (age <= ONLINE_WINDOW_MS) {
    return {online: true, minutesAgo: null};
  }
  return {online: false, minutesAgo: Math.max(1, Math.floor(age / 60_000))};
}

let running = false;

/**
 * App-lifetime heartbeat: beat now, every PRESENCE_HEARTBEAT_MS, and on every
 * return to the foreground. Each beat quietly skips out before the device has
 * opted into Friends (no cached profile) and swallows network errors, so this
 * is safe to start unconditionally from App.tsx.
 */
export function startPresenceHeartbeat(): void {
  if (running || !isBackendConfigured) {
    return;
  }
  running = true;
  const beat = () => {
    getCachedProfile()
      .then(profile => (profile ? touchPresence() : undefined))
      .catch(() => {});
  };
  beat();
  setInterval(beat, PRESENCE_HEARTBEAT_MS);
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      beat();
    }
  });
}
