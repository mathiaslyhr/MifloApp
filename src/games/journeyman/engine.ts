/**
 * Journeyman game logic — pure state transitions over `JourneymanState`, plus
 * the streak tally. No React, no persistence; the screen holds the state and
 * calls these to compute the next one.
 */
import {previousDateKey} from '../scout/dailySeed';
import type {
  GameStatus,
  HintKey,
  HistoryEntry,
  HistoryLog,
  JourneymanState,
  StreakState,
} from './types';

/** Solve in this many guesses or fewer to keep the streak (10 counts too). */
export const STREAK_GUESS_LIMIT = 10;

/** The hints in unlock order: one unlocks per wrong guess. */
export const HINT_ORDER: readonly HintKey[] = ['nationality', 'position', 'age'];

/** A fresh puzzle for the given day and secret. */
export function createInitialState(dateKey: string, secretId: string): JourneymanState {
  return {dateKey, secretId, guessedIds: [], status: 'playing'};
}

export function isFinished(state: JourneymanState): boolean {
  return state.status !== 'playing';
}

/**
 * Record a guess. Appends the id and flips the status to `won` if the guess is
 * the secret; guesses are unlimited, so the game only ends on a win or a
 * give-up. No-op if the game is over or the footballer was already guessed.
 */
export function applyGuess(state: JourneymanState, footballerId: string): JourneymanState {
  if (isFinished(state) || state.guessedIds.includes(footballerId)) {
    return state;
  }
  const guessedIds = [...state.guessedIds, footballerId];
  const status: GameStatus = footballerId === state.secretId ? 'won' : 'playing';
  return {...state, guessedIds, status};
}

/** Throw in the towel: the answer is revealed and the day ends unsolved. */
export function giveUp(state: JourneymanState): JourneymanState {
  if (isFinished(state)) {
    return state;
  }
  return {...state, status: 'revealed'};
}

/** Guesses that were not the secret — drives hint unlocks. */
export function wrongGuessCount(state: JourneymanState): number {
  return state.guessedIds.filter(id => id !== state.secretId).length;
}

/** The hints unlocked so far, in order: one per wrong guess, capped at all three. */
export function unlockedHints(state: JourneymanState): HintKey[] {
  return HINT_ORDER.slice(0, Math.min(HINT_ORDER.length, wrongGuessCount(state)));
}

/** The zero streak used before any puzzle is completed. */
export const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastCompletedDateKey: null,
};

/**
 * Fold a finished puzzle into the streak. A solve within
 * [[STREAK_GUESS_LIMIT]] guesses (10 or under) the day after the last one
 * extends the streak; after a gap it restarts at 1; giving up or an 11+ guess
 * solve breaks it. `best` never decreases. Pure — persistence lives in
 * storage.ts.
 */
export function recordResult(
  streak: StreakState,
  dateKey: string,
  guessCount: number,
  gaveUp: boolean,
): StreakState {
  if (gaveUp || guessCount > STREAK_GUESS_LIMIT) {
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
export function historyEntryFor(state: JourneymanState): HistoryEntry {
  return {
    dateKey: state.dateKey,
    status: state.status === 'won' ? 'won' : 'revealed',
    guessCount: state.guessedIds.length,
  };
}

/** Merge a day's result into the log (last write wins for that day). Pure. */
export function upsertHistory(log: HistoryLog, entry: HistoryEntry): HistoryLog {
  return {...log, [entry.dateKey]: entry};
}
