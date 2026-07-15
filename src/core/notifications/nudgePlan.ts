/**
 * Decides which notifications a day gets, from state alone. Pure: no notifee,
 * no storage, no i18n. It returns copy KEYS rather than sentences so the rules
 * can be tested as intent instead of prose, and so the renderer owns i18n.
 *
 * Two constraints shape everything here.
 *
 * Local notifications cannot be conditional at delivery, so the planner may
 * only consult state for the one day it can observe: today. Days 1..13 of the
 * window are scheduled blind (nobody knows day+3's streak), which is exactly
 * why their copy must be content-free curiosity and why no evening nudge can
 * ever be planned for them.
 *
 * The "at most two a day" cap is therefore structural rather than a check: at
 * most one window trigger lands on today, and the evening slot holds exactly
 * one message. Nothing counts, nothing can drift out of sync.
 */
import type {DailyGame} from '../daily/dailyLog';
import {dateKeyFor, hashDateKey} from '../../games/scout/dailySeed';

/** Mornings scheduled ahead before a lapsed user's reminders go quiet. */
export const WINDOW_DAYS = 14;
export const WINDOW_IDS = Array.from(
  {length: WINDOW_DAYS},
  (_, day) => `scout-daily-${day}`,
);

/**
 * The evening slot. The id predates it carrying anything but streak copy;
 * renaming would strand a pending trigger on every existing device for no
 * user-visible gain (same policy as the persisted `app.scoutReminder` key).
 */
export const EVENING_ID = 'streak-saver';

/** Pre-window repeating trigger. Devices that scheduled it before the 14-day
 * window shipped still have it pending, so it must keep being cancelled or
 * they would be pinged twice. */
export const LEGACY_WINDOW_ID = 'scout-daily';

/** The old per-game evening nudges, staggered 20:00 to 20:15, which read as a
 * barrage on a four-streak evening. Still cancelled for the same reason. */
export const LEGACY_EVENING_IDS = [
  'scout-streak',
  'tenball-streak',
  'journeyman-streak',
  'teamsheet-streak',
];

export const ALL_IDS = [
  LEGACY_WINDOW_ID,
  ...WINDOW_IDS,
  EVENING_ID,
  ...LEGACY_EVENING_IDS,
];

/** Ping this far before the habit, so the nudge arrives just as they come free. */
export const SLOT_LEAD_MINUTES = 30;

/** The slot is clamped into this window. The floor matters more than it looks:
 * a ping that lands too early is a bad enough experience to get notifications
 * killed for good, while one that lands late is merely less well timed. */
export const SLOT_MIN_MINUTES = 9 * 60;
export const SLOT_MAX_MINUTES = 22 * 60;

/** No habit recorded yet, so fall back to the fixed hour the app used to use. */
export const DEFAULT_SLOT_MINUTES = SLOT_MIN_MINUTES;

/** Late enough to be a rescue, early enough to act on. */
export const EVENING_MINUTES = 20 * 60;

export const CURIOSITY_VARIANTS = 7;

export type NudgeParams = {days?: number; count?: number; game?: DailyGame};

export type PlannedNudge = {
  id: string;
  /** i18n key; rendered by the scheduler, never here. */
  bodyKey: string;
  params?: NudgeParams;
  /** Epoch ms. */
  at: number;
};

export type NudgePlan = {
  window: PlannedNudge[];
  /** Tonight's single message, or null when the evening has nothing to say. */
  evening: PlannedNudge | null;
};

export type NudgeInput = {
  nowMs: number;
  /** Already clamped, via `slotMinutesFor`. */
  slotMinutes: number;
  allFinishedToday: boolean;
  /** Streak lengths that die tonight unplayed. */
  atRiskDays: number[];
  /** Games with a real guess today that were left unfinished. */
  startedUnfinished: DailyGame[];
};

/**
 * The habit anchor (minutes past local midnight of the user's usual session)
 * turned into the slot we actually ping at. Null means no habit is known yet.
 */
export function slotMinutesFor(anchorMinutes: number | null): number {
  if (anchorMinutes == null) {
    return DEFAULT_SLOT_MINUTES;
  }
  const lead = anchorMinutes - SLOT_LEAD_MINUTES;
  return Math.min(SLOT_MAX_MINUTES, Math.max(SLOT_MIN_MINUTES, lead));
}

/** `base`'s calendar day at `minutes` past midnight, local time. */
function dayAt(base: Date, minutes: number): Date {
  const at = new Date(base);
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return at;
}

function curiosityKey(dateKey: string): string {
  return `scout.curiosityNotifBody_${hashDateKey(dateKey) % CURIOSITY_VARIANTS}`;
}

function planEvening(input: NudgeInput, at: Date): PlannedNudge | null {
  if (at.getTime() <= input.nowMs) {
    return null;
  }
  const base = {id: EVENING_ID, at: at.getTime()};
  // A dying streak outranks everything else the evening could say.
  if (input.atRiskDays.length === 1) {
    return {
      ...base,
      bodyKey: 'scout.streakLastCallBody',
      params: {days: input.atRiskDays[0]},
    };
  }
  if (input.atRiskDays.length > 1) {
    return {
      ...base,
      bodyKey: 'scout.streaksLastCallBody',
      params: {count: input.atRiskDays.length},
    };
  }
  // Only someone who actually guessed today can be asked whether it was hard.
  if (input.startedUnfinished.length === 1) {
    return {
      ...base,
      bodyKey: 'scout.unfinishedNotifBody',
      params: {game: input.startedUnfinished[0]},
    };
  }
  if (input.startedUnfinished.length > 1) {
    return {
      ...base,
      bodyKey: 'scout.unfinishedManyNotifBody',
      params: {count: input.startedUnfinished.length},
    };
  }
  return null;
}

export function planNudges(input: NudgeInput): NudgePlan {
  const now = new Date(input.nowMs);
  const evening = planEvening(input, dayAt(now, EVENING_MINUTES));

  const slotToday = dayAt(now, input.slotMinutes);
  const skipToday =
    input.allFinishedToday ||
    slotToday.getTime() <= input.nowMs ||
    // A slot at or past the evening would stack right behind it, and "last
    // call" landing before "on the line" reads backwards. Only yield when the
    // evening is actually being sent: past 20:00 the late slot is the last
    // chance a streak gets.
    (evening !== null && input.slotMinutes >= EVENING_MINUTES);

  const first = new Date(slotToday);
  if (skipToday) {
    first.setDate(first.getDate() + 1);
  }

  const todayKey = dateKeyFor(now);
  const window = WINDOW_IDS.map((id, day) => {
    // setDate (not day * 24h) so the slot holds its wall-clock time across DST.
    const at = new Date(first);
    at.setDate(at.getDate() + day);
    const dateKey = dateKeyFor(at);
    const nudge: PlannedNudge = {id, bodyKey: curiosityKey(dateKey), at: at.getTime()};
    if (dateKey !== todayKey) {
      return nudge;
    }
    if (input.atRiskDays.length === 1) {
      return {
        ...nudge,
        bodyKey: 'scout.streakNotifBody',
        params: {days: input.atRiskDays[0]},
      };
    }
    if (input.atRiskDays.length > 1) {
      return {
        ...nudge,
        bodyKey: 'scout.streaksNotifBody',
        params: {count: input.atRiskDays.length},
      };
    }
    return nudge;
  });

  return {window, evening};
}
