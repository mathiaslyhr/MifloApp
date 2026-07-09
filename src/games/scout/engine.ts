/**
 * Scout game logic — pure state transitions over `MysteryState`,
 * plus the streak tally. No React, no persistence; the screen holds the state
 * and calls these to compute the next one.
 */
import {compareFootballers} from './compare';
import {previousDateKey} from './dailySeed';
import type {
  GameStatus,
  HistoryEntry,
  HistoryLog,
  MysteryState,
  StreakState,
} from './types';

/** Solve in fewer guesses than this to keep the streak (i.e. 1–9 keeps it). */
export const STREAK_GUESS_LIMIT = 10;

/** A fresh puzzle for the given day and secret. */
export function createInitialState(dateKey: string, secretId: string): MysteryState {
  return {dateKey, secretId, guesses: [], status: 'playing'};
}

export function isFinished(state: MysteryState): boolean {
  return state.status !== 'playing';
}

/**
 * Record a guess. Appends the compared row and flips the status to `won` if the
 * guess is the secret; guesses are unlimited, so the game only ends on a win.
 * No-op if the game is already over or the footballer was already guessed.
 */
export function applyGuess(state: MysteryState, footballerId: string): MysteryState {
  if (isFinished(state)) {
    return state;
  }
  if (state.guesses.some(g => g.footballerId === footballerId)) {
    return state;
  }
  const row = compareFootballers(footballerId, state.secretId, state.dateKey);
  const guesses = [...state.guesses, row];
  const status: GameStatus = footballerId === state.secretId ? 'won' : 'playing';
  return {...state, guesses, status};
}

/** The zero streak used before any puzzle is completed. */
export const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastCompletedDateKey: null,
};

/**
 * Fold a finished puzzle into the streak. A solve in under
 * [[STREAK_GUESS_LIMIT]] guesses the day after the last one extends the
 * streak; after a gap it restarts at 1; a solve that took 10+ guesses breaks
 * it. `best` never decreases. Pure — persistence lives in mysteryStorage.ts.
 */
export function recordResult(
  streak: StreakState,
  dateKey: string,
  guessCount: number,
): StreakState {
  if (guessCount >= STREAK_GUESS_LIMIT) {
    return {...streak, current: 0};
  }
  const continues = streak.lastCompletedDateKey === previousDateKey(dateKey);
  const current = continues ? streak.current + 1 : 1;
  return {
    current,
    best: Math.max(streak.best, current),
    lastCompletedDateKey: dateKey,
  };
}

/** Build the history entry for a finished puzzle (always a win now). */
export function historyEntryFor(state: MysteryState): HistoryEntry {
  return {
    dateKey: state.dateKey,
    status: 'won',
    guessCount: state.guesses.length,
  };
}

/** Merge a day's result into the log (last write wins for that day). Pure. */
export function upsertHistory(log: HistoryLog, entry: HistoryEntry): HistoryLog {
  return {...log, [entry.dateKey]: entry};
}
