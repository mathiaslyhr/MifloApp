/**
 * Mystery Footballer game logic — pure state transitions over `MysteryState`,
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

export const MAX_GUESSES = 6;

/** A fresh puzzle for the given day and secret. */
export function createInitialState(
  dateKey: string,
  secretId: string,
  maxGuesses: number = MAX_GUESSES,
): MysteryState {
  return {dateKey, secretId, guesses: [], status: 'playing', maxGuesses};
}

export function isFinished(state: MysteryState): boolean {
  return state.status !== 'playing';
}

export function remainingGuesses(state: MysteryState): number {
  return Math.max(0, state.maxGuesses - state.guesses.length);
}

/**
 * Record a guess. Appends the compared row and flips the status: `won` if the
 * guess is the secret, `lost` when the last guess is spent. No-op if the game is
 * already over or the footballer was already guessed.
 */
export function applyGuess(state: MysteryState, footballerId: string): MysteryState {
  if (isFinished(state)) {
    return state;
  }
  if (state.guesses.some(g => g.footballerId === footballerId)) {
    return state;
  }
  const row = compareFootballers(footballerId, state.secretId);
  const guesses = [...state.guesses, row];
  const won = footballerId === state.secretId;
  const status: GameStatus = won
    ? 'won'
    : guesses.length >= state.maxGuesses
    ? 'lost'
    : 'playing';
  return {...state, guesses, status};
}

/** The zero streak used before any puzzle is completed. */
export const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastCompletedDateKey: null,
};

/**
 * Fold a finished puzzle into the streak. A win the day after the last win
 * extends the streak; a win after a gap restarts it at 1; a loss breaks it.
 * `best` never decreases. Pure — persistence lives in mysteryStorage.ts.
 */
export function recordResult(
  streak: StreakState,
  dateKey: string,
  won: boolean,
): StreakState {
  if (!won) {
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

/** Build the history entry for a finished puzzle. */
export function historyEntryFor(state: MysteryState): HistoryEntry {
  return {
    dateKey: state.dateKey,
    status: state.status === 'won' ? 'won' : 'lost',
    guessCount: state.guesses.length,
  };
}

/** Merge a day's result into the log (last write wins for that day). Pure. */
export function upsertHistory(log: HistoryLog, entry: HistoryEntry): HistoryLog {
  return {...log, [entry.dateKey]: entry};
}
