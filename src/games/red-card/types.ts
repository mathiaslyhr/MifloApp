/**
 * Red Card — shared types + rules. The public part of the game state
 * lives on the room (`rooms.game_state`) and is broadcast to every device. The
 * two secrets (who is the imposter, which footballer) are NEVER in here — they
 * live in a private server table and are assigned + revealed server-side (see
 * `supabase/migrations/0015_footballer_imposter.sql`). Each device learns only
 * its own role via `getMyImposterRole`; the `reveal` block is written to the
 * public state only once the hand is over.
 */

export type ImposterPhase = 'asking' | 'voting' | 'reveal';

export type ImposterPlayer = {userId: string; name: string};

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
  /** 1..ROUNDS — each player asks once per round. */
  round: number;
  /** Flat ask order of userIds. */
  order: string[];
  /** The player whose turn it is to question someone (gates `play_move`). */
  turnUserId: string;
  /** Who the current asker is questioning (shown on every screen), or null. */
  askTargetUserId: string | null;
  players: ImposterPlayer[];
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

/** How many times the ask order goes around before the vote. */
export const ROUNDS = 2;

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
