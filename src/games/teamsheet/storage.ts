/**
 * Local persistence for the daily sheet + streak. Loaders fail soft (defaults
 * on a broken read); writers reject on failure so callers can warn the player
 * that progress won't survive a relaunch. No Supabase — single-player state
 * never leaves the device.
 *
 * Only the raw guess texts (plus the targeted slot, when one was tapped) are
 * stored; the screen replays them through the engine on load, so found slots
 * are recomputed and stay correct even if a lineup's aliases are expanded by
 * an OTA pack mid-day. The target rides along so a strict-mode wrong-spot
 * miss replays as the same miss. A stored day that isn't today reads back as
 * null → fresh sheet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EMPTY_STREAK, upsertHistory} from './engine';
import type {HistoryEntry, HistoryLog, StreakState, TeamsheetGuess} from './types';

const PROGRESS_KEY = 'teamsheet.progress';
const STREAK_KEY = 'teamsheet.streak';
const HISTORY_KEY = 'teamsheet.history';

/** The persisted shape of today's progress. */
export type DailyProgress = {
  dateKey: string;
  /**
   * The lineup these guesses were made against. The screen discards the
   * whole progress when this no longer matches today's scheduled lineup —
   * the frozen schedule is the source of truth, and replaying guesses
   * against a different XI would corrupt the day.
   */
  lineupId: string;
  /** Raw guesses in order; `slot` is ignored on replay, `target` is not. */
  guesses: TeamsheetGuess[];
  gaveUp: boolean;
};

/** Today's saved progress, or null if none / it belongs to a different day. */
export async function loadDailyProgress(
  dateKey: string,
): Promise<DailyProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return null;
    }
    const saved = JSON.parse(raw) as DailyProgress;
    return saved.dateKey === dateKey ? saved : null;
  } catch {
    return null;
  }
}

export async function saveDailyProgress(progress: DailyProgress): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

/**
 * The stored progress regardless of which day it belongs to, or null. Unlike
 * [[loadDailyProgress]] this does not drop a past day — the rollover reconcile
 * uses it to fail a day left unfinished when the calendar moved on.
 */
export async function loadRawProgress(): Promise<DailyProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as DailyProgress) : null;
  } catch {
    return null;
  }
}

/** Drop the saved progress slot (after a stale day has been reconciled). */
export async function clearProgress(): Promise<void> {
  await AsyncStorage.removeItem(PROGRESS_KEY);
}

export async function loadStreak(): Promise<StreakState> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    return raw ? (JSON.parse(raw) as StreakState) : EMPTY_STREAK;
  } catch {
    return EMPTY_STREAK;
  }
}

export async function saveStreak(streak: StreakState): Promise<void> {
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

/** The full past-results log (keyed by dateKey), or an empty log. */
export async function loadHistory(): Promise<HistoryLog> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryLog) : {};
  } catch {
    return {};
  }
}

/** Record one finished day into the log and persist it. Returns the new log. */
export async function recordHistory(entry: HistoryEntry): Promise<HistoryLog> {
  const log = upsertHistory(await loadHistory(), entry);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(log));
  return log;
}
