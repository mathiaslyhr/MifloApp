/**
 * Types for Top Bins — a daily single-player top-10 quiz. One curated list per
 * calendar day; the player types answers and fills the board slot by slot.
 * Guesses are unlimited, wrong ones just count as misses.
 *
 * Everything here is plain data: the engine (engine.ts) is pure, so the whole
 * game runs locally with no room/Supabase.
 */

/** One answer slot on a list's board. */
export type TenballEntry = {
  /** 1..10, unique within the list. Real-world ties are ordered by the curator. */
  rank: number;
  /** Display name shown when the slot is revealed, e.g. 'Gerd Müller'. */
  name: string;
  /**
   * The stat, rendered verbatim next to the name, e.g. '16' or '€222m'. A
   * string on purpose: curated formatting (units, '+' for still-counting
   * active players) survives untouched. The unit lives in the list title.
   */
  value: string;
  /**
   * Accepted answers: lowercase, accent-folded (playerSearch `fold`), unique
   * across the whole list — every answer owns exactly one slot, so "Last 10"
   * lists must dedupe repeat winners ("the last 10 DIFFERENT winners").
   * Always include the bare surname unless it is ambiguous within the list
   * (two Ronaldos: neither owns 'ronaldo'). Danish æ/ø/å do not fold to
   * ASCII, so those names carry both spellings.
   */
  aliases: string[];
  /** Link into FOOTBALLERS when the player is in the dataset (flag art only). */
  footballerId?: string;
};

/** What a list's answers are — drives which pool the type-ahead searches. */
export type TenballKind = 'player' | 'club' | 'nation' | 'manager' | 'other';

/** One curated top-10 list. The id is also the i18n key `tenball.lists.<id>.title`. */
export type TenballList = {
  id: string;
  /**
   * Optional so a new binary reading an old cached OTA pack still works:
   * treat `undefined` as `'player'` everywhere it is read.
   */
  kind?: TenballKind;
  entries: TenballEntry[];
};

/** How a single typed guess landed. */
export type GuessOutcome = 'hit' | 'miss' | 'already-found' | 'repeat';

/** One submitted guess: the folded text, plus the rank it revealed on a hit. */
export type TenballGuess = {
  text: string;
  rank?: number;
};

/** `'revealed'` = the player gave up and the board was shown. */
export type GameStatus = 'playing' | 'won' | 'revealed';

/** The full in-memory state of today's puzzle. */
export type TenballState = {
  /** Local calendar day, `YYYY-MM-DD`. Ties the puzzle to a date. */
  dateKey: string;
  /** Pinned on first open so a mid-day OTA pack can't swap the puzzle. */
  listId: string;
  guesses: TenballGuess[];
  status: GameStatus;
};

/** Local streak tally, persisted across days. */
export type StreakState = {
  current: number;
  best: number;
  /** The `dateKey` of the last day the board was completed, or null. */
  lastCompletedDateKey: string | null;
};

/** One finished day's outcome, kept for a future archive. */
export type HistoryEntry = {
  dateKey: string;
  listId: string;
  status: 'won' | 'revealed';
  /** Slots found by the player (10 on a win). */
  found: number;
  misses: number;
};

/** The persisted results log, keyed by `dateKey` for cheap upsert/lookup. */
export type HistoryLog = Record<string, HistoryEntry>;
