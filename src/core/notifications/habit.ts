/**
 * When the user is actually free, learned from their own behaviour.
 *
 * The old nudge fired at a fixed 09:00, which is a guess. This records when
 * sessions really happen and lets `nudgePlan` ping just before the habitual
 * moment instead: roughly 23.5h after a session, because that was the moment
 * yesterday when they demonstrably had time.
 *
 * Two things protect the signal.
 *
 * A session that started right after a nudge we fired was caused by us and
 * proves nothing about when the user is free. Counting those walks the slot 30
 * minutes earlier every single day until a 20:00 player is pinged at
 * breakfast, so they are ignored. Knowing this needs no notifee delivery API:
 * every sync already knows the timestamps it scheduled, so it writes them down
 * and a session start is checked against the ledger.
 *
 * The anchor is the median of recent sessions rather than the last one. A
 * single sample means one late-night browse yanks a morning player's slot to
 * the evening and destroys the 09:00 they came for; a median shrugs it off and
 * tracks the habit rather than the most recent accident.
 *
 * Nothing here leaves the device, and every entry point swallows its errors:
 * scheduling hiccups must never affect gameplay.
 */
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {DEFAULT_SLOT_MINUTES, slotMinutesFor} from './nudgePlan';

/** Minutes-of-day that the last few days were first opened. */
const SESSIONS_KEY = 'app.habitSessions';
/** Start of the last recorded session, so each day samples only once. */
const LAST_SESSION_KEY = 'app.lastSessionAt';
/** Fire times this device has scheduled: recent past plus everything pending. */
const FIRE_ATS_KEY = 'app.nudgeFireAts';

/** A session starting this soon after a nudge fired is treated as ours. */
export const ORGANIC_GRACE_MS = 45 * 60_000;

/** Enough to out-vote an outlier, few enough to follow a real routine change. */
export const HABIT_SAMPLES = 5;

/** How long a fired nudge stays on the ledger. Only the grace window reads it. */
export const FIRE_LEDGER_MS = 24 * 60 * 60_000;

async function readNumbers(key: string): Promise<number[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter(n => typeof n === 'number') : [];
}

function minutesOfDay(ms: number): number {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Did the user open the app on their own, or because we pinged them? Only a
 * session in the grace window *after* a nudge that has already fired counts as
 * ours; anything earlier, later, or still pending is the user's own doing.
 */
export function isOrganicSession(
  startedAtMs: number,
  fireAts: readonly number[],
): boolean {
  return !fireAts.some(
    firedAt => firedAt <= startedAtMs && startedAtMs - firedAt < ORGANIC_GRACE_MS,
  );
}

/** The habitual session time, or null before anything is known. */
export function anchorMinutesFrom(samples: readonly number[]): number | null {
  if (samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Fold the fire times a sync just scheduled into the ledger. Stored futures are
 * dropped rather than kept: notifee upserts by id, so anything the previous
 * sync planned and this one did not re-plan has been overwritten and will never
 * fire. Past entries age out after a day, which bounds the list at roughly the
 * pending window plus a couple of fires.
 */
export function mergeFireAts(
  stored: readonly number[],
  planned: readonly number[],
  nowMs: number,
): number[] {
  const fired = stored.filter(t => t <= nowMs && nowMs - t < FIRE_LEDGER_MS);
  return [...new Set([...fired, ...planned])].sort((a, b) => a - b);
}

/** The slot to schedule at, already clamped. 09:00 until a habit is known. */
export async function loadHabitSlotMinutes(): Promise<number> {
  try {
    return slotMinutesFor(anchorMinutesFrom(await readNumbers(SESSIONS_KEY)));
  } catch {
    return DEFAULT_SLOT_MINUTES;
  }
}

/** Write down what a sync just scheduled, so we can recognise our own nudges. */
export async function rememberNudgeFires(
  planned: readonly number[],
): Promise<void> {
  try {
    const merged = mergeFireAts(
      await readNumbers(FIRE_ATS_KEY),
      planned,
      Date.now(),
    );
    await AsyncStorage.setItem(FIRE_ATS_KEY, JSON.stringify(merged));
  } catch {
    // Losing the ledger only means the anchor stops moving. Harmless.
  }
}

/**
 * Record that the app came alive. Returns whether the habit anchor actually
 * moved; a second session the same day, one we caused, or one that leaves the
 * median where it was all return false.
 *
 * Only the FIRST session of each day is a candidate, because the first open is
 * exactly what the slot is trying to predict. It also stops one restless
 * afternoon from outvoting a week of mornings: a committed 09:00 player who
 * spends a sick day opening the app hourly would otherwise fill every sample
 * from that one day and lose their morning slot for a week.
 *
 * A day whose first open was ours is consumed without being sampled, rather
 * than falling through to the next session of the day. Otherwise a 09:00
 * player who answers our 08:30 ping and later browses at 20:00 would be
 * sampled at 20:00, and the slot would walk into the evening.
 */
export async function recordSession(
  startedAtMs: number = Date.now(),
): Promise<boolean> {
  try {
    const [lastRaw, samples, fireAts] = await Promise.all([
      AsyncStorage.getItem(LAST_SESSION_KEY),
      readNumbers(SESSIONS_KEY),
      readNumbers(FIRE_ATS_KEY),
    ]);
    const last = lastRaw == null ? null : Number(lastRaw);
    if (
      last != null &&
      dateKeyFor(new Date(last)) === dateKeyFor(new Date(startedAtMs))
    ) {
      return false;
    }
    await AsyncStorage.setItem(LAST_SESSION_KEY, String(startedAtMs));
    if (!isOrganicSession(startedAtMs, fireAts)) {
      return false;
    }
    const next = [...samples, minutesOfDay(startedAtMs)].slice(-HABIT_SAMPLES);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
    return anchorMinutesFrom(next) !== anchorMinutesFrom(samples);
  } catch {
    return false;
  }
}

let running = false;

/**
 * App-lifetime session tracking: record now and on every return to the
 * foreground, then let the caller re-sync. `onSession` fires on every session
 * rather than only when the anchor moves, because the nudge window also needs
 * re-anchoring after a midnight rollover or a timezone change, which nothing
 * else in the app currently does.
 */
export function startHabitTracking(onSession: () => void): void {
  if (running) {
    return;
  }
  running = true;
  const record = () => {
    // Order matters: the anchor must be written before the caller reads it.
    recordSession()
      .catch(() => {})
      .then(() => onSession());
  };
  record();
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      record();
    }
  });
}
