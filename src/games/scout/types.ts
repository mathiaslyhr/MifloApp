/**
 * Types for Scout — a Wordle-style daily single-player game. One
 * secret footballer per calendar day; each guess returns a row of coloured
 * cells comparing the guess to the secret across a fixed set of columns.
 *
 * Everything here is plain data: the engine (engine.ts) and comparison logic
 * (compare.ts) are pure, so the whole game runs locally with no room/Supabase.
 */

/** The feedback columns, in display order. */
export type ColumnKey =
  | 'nationality'
  | 'position'
  | 'club'
  | 'league'
  | 'age';

/** How a single guessed attribute compares to the secret. */
export type CellStatus = 'hit' | 'partial' | 'miss';

/** For numeric columns, whether the secret's value is higher/lower than the guess. */
export type Direction = 'up' | 'down';

export type CellResult = {
  key: ColumnKey;
  status: CellStatus;
  /** Only set on numeric columns (age) when the value differs. */
  direction?: Direction;
};

/** One played guess: the footballer picked plus the per-column comparison. */
export type GuessRow = {
  footballerId: string;
  cells: CellResult[];
};

/** `'revealed'` = the player gave up and the secret was shown. */
export type GameStatus = 'playing' | 'won' | 'revealed';

/** The full in-memory state of today's puzzle. Guesses are unlimited. */
export type MysteryState = {
  /** Local calendar day, `YYYY-MM-DD`. Ties the puzzle to a date. */
  dateKey: string;
  secretId: string;
  guesses: GuessRow[];
  status: GameStatus;
};

/** Local streak tally, persisted across days. */
export type StreakState = {
  current: number;
  best: number;
  /** The `dateKey` of the last day the puzzle was solved, or null. */
  lastCompletedDateKey: string | null;
};

/** One finished day's outcome, kept for the past-puzzles archive. */
export type HistoryEntry = {
  dateKey: string;
  /** `'revealed'` = gave up. `'lost'` only appears in logs saved before
   * guesses became unlimited; both read as surrendered downstream. */
  status: 'won' | 'revealed' | 'lost';
  /** Guesses used to solve the puzzle. */
  guessCount: number;
};

/** The persisted results log, keyed by `dateKey` for cheap upsert/lookup. */
export type HistoryLog = Record<string, HistoryEntry>;
