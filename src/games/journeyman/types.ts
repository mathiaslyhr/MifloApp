/**
 * Types for Journeyman — a daily single-player game. One secret footballer per
 * calendar day; their full career path (club spells) is on the board from the
 * start and the player names them in as few guesses as possible. Wrong guesses
 * unlock hints (nationality, position, age) one at a time.
 *
 * Everything here is plain data: the engine (engine.ts) is pure, so the whole
 * game runs locally with no room/Supabase.
 */

export type GameStatus = 'playing' | 'won' | 'revealed';

/** The hints, in unlock order — one per wrong guess. */
export type HintKey = 'nationality' | 'position' | 'age';

/** The full in-memory state of today's puzzle. Guesses are unlimited. */
export type JourneymanState = {
  /** Local calendar day, `YYYY-MM-DD`. Ties the puzzle to a date. */
  dateKey: string;
  secretId: string;
  /** Guessed footballer ids in order; the last one is the secret on a win. */
  guessedIds: string[];
  status: GameStatus;
};

/** Local streak tally, persisted across days. */
export type StreakState = {
  current: number;
  best: number;
  /** The `dateKey` of the last day the puzzle was completed, or null. */
  lastCompletedDateKey: string | null;
};

/** One finished day's outcome, kept for the results log. */
export type HistoryEntry = {
  dateKey: string;
  status: 'won' | 'revealed';
  /** Guesses used (wrong ones included; the winning guess counts too). */
  guessCount: number;
};

/** The persisted results log, keyed by `dateKey` for cheap upsert/lookup. */
export type HistoryLog = Record<string, HistoryEntry>;
