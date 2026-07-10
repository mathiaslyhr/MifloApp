/**
 * Types for Team sheet — a daily single-player lineup quiz. One famous
 * starting XI per calendar day; the player types names and fills the
 * formation board slot by slot. Guesses are unlimited, wrong ones just count
 * as misses.
 *
 * Everything here is plain data: the engine (engine.ts) is pure, so the whole
 * game runs locally with no room/Supabase. The lineup content itself lives in
 * the football data layer (famousLineups.ts) and ships OTA.
 */

/** How a single typed guess landed. `'wrong-slot'` = the name is in the XI
 * but not at the targeted spot (counts as a miss — strict positional mode). */
export type GuessOutcome = 'hit' | 'miss' | 'wrong-slot' | 'already-found' | 'repeat';

/** One submitted guess: the folded text, plus the slot it revealed on a hit
 * and the spot that was targeted (tapped) when it was submitted. `target` is
 * persisted so a wrong-spot miss replays as the same miss. */
export type TeamsheetGuess = {
  text: string;
  /** Index into the lineup's players array (0 = GK). */
  slot?: number;
  /** The slot selected when this guess was submitted, if any. */
  target?: number;
};

/** `'revealed'` = the player gave up and the sheet was shown. */
export type GameStatus = 'playing' | 'won' | 'revealed';

/** The full in-memory state of today's puzzle. */
export type TeamsheetState = {
  /** Local calendar day, `YYYY-MM-DD`. Ties the puzzle to a date. */
  dateKey: string;
  /** Pinned on first open so a mid-day OTA pack can't swap the puzzle. */
  lineupId: string;
  guesses: TeamsheetGuess[];
  status: GameStatus;
};

/** Local streak tally, persisted across days. */
export type StreakState = {
  current: number;
  best: number;
  /** The `dateKey` of the last day the sheet was completed, or null. */
  lastCompletedDateKey: string | null;
};

/** One finished day's outcome, kept for a future archive. */
export type HistoryEntry = {
  dateKey: string;
  lineupId: string;
  status: 'won' | 'revealed';
  /** Slots found by the player (11 on a win). */
  found: number;
  misses: number;
};

/** The persisted results log, keyed by `dateKey` for cheap upsert/lookup. */
export type HistoryLog = Record<string, HistoryEntry>;
