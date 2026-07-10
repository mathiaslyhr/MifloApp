/**
 * Local persistence for the daily board + streak. Loaders fail soft (defaults
 * on a broken read); writers reject on failure so callers can warn the player
 * that progress won't survive a relaunch. No Supabase — single-player state
 * never leaves the device.
 *
 * Only the raw guess texts are stored; the screen replays them through the
 * engine on load, so revealed slots are recomputed and stay correct even if a
 * list's aliases are expanded by an OTA pack mid-day. A stored day that isn't
 * today reads back as null → fresh board.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EMPTY_STREAK, upsertHistory} from './engine';
import type {HistoryEntry, HistoryLog, StreakState, TenballGuess} from './types';

const PROGRESS_KEY = 'tenball.progress';
const STREAK_KEY = 'tenball.streak';
const HISTORY_KEY = 'tenball.history';

/** The persisted shape of today's progress. */
export type DailyProgress = {
  dateKey: string;
  /**
   * The list drawn when the day was first opened. Pins the puzzle: an OTA
   * pack mid-day can reshuffle the fallback walk, and without the pin the
   * board would silently swap under an in-progress game.
   */
  listId: string;
  /** Raw guesses in order; `rank` is ignored on replay. */
  guesses: TenballGuess[];
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
