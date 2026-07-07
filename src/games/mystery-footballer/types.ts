/**
 * Types for Mystery Footballer — a Wordle-style daily single-player game. One
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
  | 'shirtNumber';

/** How a single guessed attribute compares to the secret. */
export type CellStatus = 'hit' | 'partial' | 'miss';

/** For numeric columns, whether the secret's value is higher/lower than the guess. */
export type Direction = 'up' | 'down';

export type CellResult = {
  key: ColumnKey;
  status: CellStatus;
  /** Only set on numeric columns (shirtNumber, era) when the value differs. */
  direction?: Direction;
};

/** One played guess: the footballer picked plus the per-column comparison. */
export type GuessRow = {
  footballerId: string;
  cells: CellResult[];
};

export type GameStatus = 'playing' | 'won' | 'lost';

/** The full in-memory state of today's puzzle. */
export type MysteryState = {
  /** Local calendar day, `YYYY-MM-DD`. Ties the puzzle to a date. */
  dateKey: string;
  secretId: string;
  guesses: GuessRow[];
  status: GameStatus;
  maxGuesses: number;
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
  status: 'won' | 'lost';
  /** Guesses used (equals maxGuesses on a loss). */
  guessCount: number;
};

/** The persisted results log, keyed by `dateKey` for cheap upsert/lookup. */
export type HistoryLog = Record<string, HistoryEntry>;
