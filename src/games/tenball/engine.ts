/**
 * Top Bins game logic — pure state transitions over `TenballState`, plus the
 * streak tally. No React, no persistence; the screen holds the state and calls
 * these to compute the next one.
 *
 * Guess matching runs against the day's list alias tables (lists.ts), never
 * the footballer dataset — curated answers include retired legends the
 * dataset has never heard of.
 */
import {fold} from '../hattrick/playerSearch';
import {previousDateKey} from '../scout/dailySeed';
import type {
  GameStatus,
  GuessOutcome,
  HistoryEntry,
  HistoryLog,
  StreakState,
  TenballList,
  TenballState,
} from './types';

/** Complete the board with this many misses or fewer to keep the streak. */
export const STREAK_MISS_LIMIT = 10;

/** A fresh board for the given day and list. */
export function createInitialState(dateKey: string, listId: string): TenballState {
  return {dateKey, listId, guesses: [], status: 'playing'};
}

export function isFinished(state: TenballState): boolean {
  return state.status !== 'playing';
}

/** The ranks the player has revealed so far. */
export function foundRanks(state: TenballState): Set<number> {
  const ranks = new Set<number>();
  for (const guess of state.guesses) {
    if (guess.rank !== undefined) {
      ranks.add(guess.rank);
    }
  }
  return ranks;
}

/** Wrong guesses so far — the score, lower is better. */
export function missCount(state: TenballState): number {
  return state.guesses.reduce((n, g) => n + (g.rank === undefined ? 1 : 0), 0);
}

/**
 * The rank whose alias table contains the folded text, if any. Every answer
 * appears exactly once per list (a curation rule the lists test enforces), so
 * a correct name always lands in exactly one slot.
 */
export function matchGuess(list: TenballList, foldedText: string): number | undefined {
  for (const entry of list.entries) {
    if (entry.aliases.includes(foldedText)) {
      return entry.rank;
    }
  }
  return undefined;
}

/**
 * Record a typed guess. A hit fills its rank slot (and wins the game on the
 * 10th); anything else appends a miss. Repeating the exact same wrong text, or
 * naming a player already on the board, is a no-op — misses never double-count.
 * Blank input and finished games are no-ops too (reported as `'repeat'`).
 */
export function applyGuess(
  state: TenballState,
  list: TenballList,
  rawText: string,
): {state: TenballState; outcome: GuessOutcome} {
  const text = fold(rawText);
  if (isFinished(state) || text.length === 0) {
    return {state, outcome: 'repeat'};
  }
  const rank = matchGuess(list, text);
  if (rank !== undefined && foundRanks(state).has(rank)) {
    return {state, outcome: 'already-found'};
  }
  if (rank === undefined && state.guesses.some(g => g.text === text)) {
    return {state, outcome: 'repeat'};
  }
  const guesses = [...state.guesses, rank === undefined ? {text} : {text, rank}];
  const won = rank !== undefined && foundRanks({...state, guesses}).size === list.entries.length;
  const status: GameStatus = won ? 'won' : 'playing';
  return {
    state: {...state, guesses, status},
    outcome: rank === undefined ? 'miss' : 'hit',
  };
}

/** Throw in the towel: the board is revealed and the day ends unsolved. */
export function giveUp(state: TenballState): TenballState {
  if (isFinished(state)) {
    return state;
  }
  return {...state, status: 'revealed'};
}

/** The zero streak used before any board is completed. */
export const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastCompletedDateKey: null,
};

/**
 * Fold a finished board into the streak. Completing all 10 with
 * [[STREAK_MISS_LIMIT]] misses or fewer the day after the last one extends
 * the streak; after a gap it restarts at 1; giving up or 11+ misses breaks
 * it. `best` never decreases. Pure — persistence lives in storage.ts.
 */
export function recordResult(
  streak: StreakState,
  dateKey: string,
  misses: number,
  gaveUp: boolean,
): StreakState {
  if (gaveUp || misses > STREAK_MISS_LIMIT) {
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

/** Build the history entry for a finished board. */
export function historyEntryFor(state: TenballState): HistoryEntry {
  return {
    dateKey: state.dateKey,
    listId: state.listId,
    status: state.status === 'won' ? 'won' : 'revealed',
    found: foundRanks(state).size,
    misses: missCount(state),
  };
}

/** Merge a day's result into the log (last write wins for that day). Pure. */
export function upsertHistory(log: HistoryLog, entry: HistoryEntry): HistoryLog {
  return {...log, [entry.dateKey]: entry};
}
