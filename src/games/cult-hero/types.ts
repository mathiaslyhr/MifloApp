/**
 * Cult Hero — shared types + rules. Pointless with football players: every
 * round shows one prompt ("Name a player who has played for Real Madrid"),
 * everyone secretly picks a real footballer at the same time, and the rarest
 * valid answer scores the most. A pick that doesn't match the prompt is worth
 * nothing.
 *
 * Unlike Red Card there are no per-player secrets, so the whole coordination
 * state is public on `rooms.game_state`; only the current round's picks hide
 * in a private server table until everyone is in (see
 * `supabase/migrations/0018_cult_hero.sql`). Rarity is scored SERVER-SIDE:
 * the host ships a fame prior for each prompt's eligible players at start, and
 * the server folds in the global pick counts accumulated by every Cult Hero
 * game ever played, so scores agree across devices no matter which OTA dataset
 * version each one runs.
 */

export type CultHeroPhase = 'answering' | 'roundReveal' | 'leaderboard' | 'final';

export type CultHeroPlayer = {userId: string; name: string};

/** One scored answer, published when the round resolves. */
export type CultHeroResult = {
  userId: string;
  footballerId: string;
  /** The pick matches the prompt — a wrong answer is always worth 0. */
  valid: boolean;
  /** Obscurity percentile among the prompt's eligible players, 0..100. */
  score: number;
};

export type CultHeroState = {
  gameType: 'cult-hero';
  phase: CultHeroPhase;
  /** 1..rounds — one shared prompt per round. */
  round: number;
  /** Host-picked round count, MIN_ROUNDS..MAX_ROUNDS. */
  rounds: number;
  /** Stable prompt keys (see `prompts.ts`); each device localizes its own. */
  promptKeys: string[];
  /**
   * Gates `play_move`: null while answering (nobody can write the state), the
   * host's id from the round's resolve through the leaderboard (only the host
   * pages the results and moves the game on).
   */
  turnUserId: string | null;
  players: CultHeroPlayer[];
  /** How many have answered this round (picks stay hidden until all are in). */
  answeredCount: number;
  /**
   * This round's scored answers, most-picked first so the reveal builds up to
   * the rarest. Present from the resolve until the next round starts (kept
   * through 'leaderboard' and 'final' so the round's deltas can show).
   */
  results?: CultHeroResult[];
  /** Which result is on screen during roundReveal (0-based). */
  revealIndex: number;
  /** Running totals across rounds. */
  scores: Record<string, number>;
};

/** The host picks how many prompts a game runs. */
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 5;
export const DEFAULT_ROUNDS = 4;

/** Rarity is judged against the world, not the table, so two players work. */
export const MIN_PLAYERS = 2;

/**
 * A prompt qualifies only if at least this many dataset players match it —
 * enforced when candidates are built AND by the start RPC, so a shrunk
 * eligible set can't game the percentile.
 */
export const MIN_ELIGIBLE = 10;

/**
 * Fame-prior pseudo-counts average this per eligible player. Real global picks
 * add +1 each, so observed behaviour overtakes the editorial prior after a few
 * dozen games per prompt.
 */
export const PSEUDO_PER_PLAYER = 5;
