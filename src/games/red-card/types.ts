/**
 * Red Card — shared types + rules. The public part of the game state
 * lives on the room (`rooms.game_state`) and is broadcast to every device. The
 * two secrets (who is the imposter, which footballer) are NEVER in here — they
 * live in a private server table and are assigned + revealed server-side (see
 * `supabase/migrations/0015_footballer_imposter.sql`). Each device learns only
 * its own role via `getMyImposterRole`; the `reveal` block is written to the
 * public state only once the hand is over.
 */

export type ImposterPhase = 'answering' | 'answerReveal' | 'voting' | 'reveal';

export type ImposterPlayer = {userId: string; name: string};

/** One revealed answer, attributed; the order was randomized server-side. */
export type ImposterAnswer = {userId: string; text: string};

/** The end-of-hand summary, made public once everyone has voted. */
export type ImposterReveal = {
  imposterId: string;
  footballerId: string;
  /** The majority (most-voted) picked the imposter. */
  caught: boolean;
  /** voterUserId -> the userId they voted for. */
  votes: Record<string, string>;
  /** A caught imposter's redemption guess, once made. */
  redemption?: {guessId: string; correct: boolean};
  /** Points earned by each player this hand. */
  deltas: Record<string, number>;
};

export type ImposterState = {
  gameType: 'red-card';
  phase: ImposterPhase;
  /** 1..rounds — one shared question per round. */
  round: number;
  /** Host-picked question count, MIN_ROUNDS..MAX_ROUNDS. */
  rounds: number;
  /** Stable question ids (see `questions.ts`); each device localizes its own. */
  questionIds: string[];
  /**
   * Gates `play_move`: null during answering/voting (nobody can write the
   * state), the host's id during answerReveal (only the host pages answers).
   */
  turnUserId: string | null;
  players: ImposterPlayer[];
  /** How many players have answered this round (texts stay hidden until all). */
  answeredCount: number;
  /** This round's answers, public once everyone has submitted. */
  answers?: ImposterAnswer[];
  /** Which answer is on screen during answerReveal (0-based). */
  answerIndex: number;
  /** How many players have voted (identities stay hidden until reveal). */
  votedCount: number;
  /** Running totals across hands. */
  scores: Record<string, number>;
  reveal?: ImposterReveal;
};

/** A device's private role, fetched from the server (never in `game_state`). */
export type ImposterRole =
  | {role: 'imposter'}
  | {role: 'detective'; footballerId: string};

/** The host picks how many question rounds a hand runs before the vote.
 * Bounds mirror the start/restart RPCs (raised to 10 in migration 0021). */
export const MIN_ROUNDS = 2;
export const MAX_ROUNDS = 10;
export const DEFAULT_ROUNDS = 2;

/** Hard cap on a typed answer, enforced client-side AND in the submit RPC. */
export const ANSWER_MAX_LEN = 80;

/** Fewest players for a meaningful hand (1 imposter + ≥2 detectives to vote). */
export const MIN_PLAYERS = 3;

/**
 * The host ships the full pool of eligible footballer ids and the server
 * privately picks one, so the host never learns the secret. Only footballers we
 * have an illustration for are eligible (the reveal always shows a portrait);
 * the server rejects pools smaller than this so a shrunk pool can't leak the
 * secret. Keep ≤ the number of illustrated players (see `eligibleFootballerIds`).
 */
export const MIN_POOL = 12;

/** Points, tunable. Mirrors the authoritative scoring in the migration. */
export const SCORE = {
  /** A detective who voted for the real imposter. */
  detectiveCorrect: 1,
  /** The imposter escaped the majority vote. */
  imposterEscape: 3,
  /** A caught imposter who then named the secret footballer. */
  imposterRedeem: 2,
} as const;
