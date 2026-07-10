/**
 * Offside — shared types + rules. An online race: every round shows four
 * footballers, three share a hidden attribute and one is offside; everyone
 * taps the outlier at the same time and faster correct answers score more.
 *
 * Everything here is public: the whole game state (deck included) lives on the
 * room (`rooms.game_state`) and is broadcast to every device. There are no
 * secrets to protect — the server still re-verifies each answer against the
 * stored deck so submitted points can't lie (see
 * `supabase/migrations/0017_offside.sql`).
 */
import type {Criterion} from '../../data/football';

export type OffsidePhase = 'question' | 'reveal' | 'standings';

export type OffsidePlayer = {userId: string; name: string};

/** One of the four players shown in a round. */
export type OffsideCard = {
  footballerId: string;
  name: string;
};

/**
 * One round of the host-built deck. Plain JSON — `criterion` is a serialisable
 * discriminated union from the football fact layer, kept on the round so each
 * device can localize the reveal explanation and the server can verify answers.
 */
export type OffsideRound = {
  /** Exactly four players, already shuffled. */
  cards: OffsideCard[];
  /** Index into `cards` of the odd one out. */
  outlierIndex: number;
  /** The attribute the other three share. */
  criterion: Criterion;
};

/** A submitted answer; `option` is null when the timer ran out unanswered. */
export type OffsideAnswer = {option: number | null; points: number};

export type OffsideState = {
  gameType: 'offside';
  phase: OffsidePhase;
  /** 1..rounds — one deck entry per round. */
  round: number;
  rounds: number;
  /** Host-built via `buildRounds`, validated + stored by the start RPC. */
  deck: OffsideRound[];
  /** Server-clock deadline (ISO) for the current question; null otherwise. */
  roundEndsAt: string | null;
  /** Always null: the generic `play_move` RPC stays locked for this game. */
  turnUserId: null;
  players: OffsidePlayer[];
  /** This round's answers by userId; cleared when the host advances. */
  answers: Record<string, OffsideAnswer>;
  answeredCount: number;
  /** Running totals, accumulated server-side when a round resolves. */
  scores: Record<string, number>;
};

/** The host picks how many rounds a game runs. */
export const ROUND_COUNT_OPTIONS = [5, 10, 15] as const;
export const DEFAULT_ROUNDS = 10;

/** An odd-one-out race works head-to-head, so the room minimum applies. */
export const MIN_PLAYERS = 2;

/**
 * How long a player has to answer one question. Mirrors the authoritative
 * `interval '20 seconds'` in `supabase/migrations/0017_offside.sql`.
 */
export const QUESTION_DURATION_MS = 20_000;

/**
 * How long past the deadline the host waits before force-resolving the round
 * for players who never answered (left, backgrounded, offline).
 */
export const FORCE_REVEAL_GRACE_MS = 3_000;

/** Floor for a correct answer; speed bonus is added on top up to MAX_POINTS. */
export const BASE_POINTS = 500;
export const MAX_POINTS = 1000;
