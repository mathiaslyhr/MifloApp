/**
 * Host-liveness timers for online parties.
 *
 * The host's device pings the server while foregrounded (heartbeat); every
 * guest runs a watchdog that is reset by any live room event. When a guest's
 * watchdog expires it may ask the server to close the room, but the server
 * only agrees if the host has truly been silent (see 0019_host_liveness.sql),
 * so a disconnected guest can never kill a live party.
 */
import {AppState} from 'react-native';

/**
 * Host ping cadence while foregrounded. Two beats fit inside the server's
 * 60s stale window (0019_host_liveness.sql; change together), so one dropped
 * request never makes a live host look stale.
 */
export const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Guest countdown since the last rooms event. Exceeds the server's 60s
 * threshold plus the max 25s heartbeat gap, so when a room is truly stale the
 * first close attempt is decisive.
 */
export const STALE_ROOM_TIMEOUT_MS = 90_000;

/** Re-arm delay after a skipped or refused close attempt. */
export const STALE_RETRY_MS = 15_000;

/** Spread simultaneous multi-guest close attempts apart. */
const MAX_JITTER_MS = 10_000;

/**
 * Host only: beat immediately, then every HEARTBEAT_INTERVAL_MS, plus an
 * immediate beat whenever the app returns to the foreground (iOS suspends JS
 * timers in the background, which is exactly what makes an abandoned host
 * detectable). Returns a dispose function.
 */
export function createHostHeartbeat(beat: () => void): () => void {
  beat();
  const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') {
      beat();
    }
  });
  return () => {
    clearInterval(interval);
    appState.remove();
  };
}

export type StaleWatchdog = {
  /** A live room event arrived: restart the full countdown. */
  poke: () => void;
  /** Close attempt skipped/refused: try again after `ms`. */
  rearm: (ms: number) => void;
  dispose: () => void;
};

/**
 * Guest only: fires `onExpired` once when `poke()` hasn't been called for
 * `timeoutMs` plus 0-10s of jitter. Does not auto-repeat — `onExpired`
 * decides whether to `rearm()`, and a later `poke()` restarts the countdown.
 */
export function createStaleWatchdog(
  onExpired: () => void,
  timeoutMs: number = STALE_ROOM_TIMEOUT_MS,
): StaleWatchdog {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const schedule = (ms: number) => {
    if (disposed) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      onExpired();
    }, ms);
  };

  schedule(timeoutMs + Math.random() * MAX_JITTER_MS);
  return {
    poke: () => schedule(timeoutMs + Math.random() * MAX_JITTER_MS),
    rearm: (ms: number) => schedule(ms),
    dispose: () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
