/**
 * Odd One Out config + shared domain types. A round shows four players; three
 * share a hidden attribute and one — the outlier — doesn't. Players pick the
 * outlier; the reveal explains the shared attribute.
 *
 * The deck (OddRound[]) is built by the host and broadcast to the room, so it
 * must be plain JSON — `criterion` is a serialisable discriminated union from
 * the football fact layer, kept on the round so the answer is verifiable.
 */
import type {Criterion} from '../../data/football';

/** One of the four players shown in a round. */
export type OddCard = {
  footballerId: string;
  name: string;
};

export type OddRound = {
  /** Exactly four players, already shuffled. */
  cards: OddCard[];
  /** Index into `cards` of the odd one out — the player the others beat. */
  outlierIndex: number;
  /** The attribute the other three share; lets the answer be re-verified. */
  criterion: Criterion;
  /** Human-readable reveal, e.g. "Three of them won the Champions League." */
  explanation: string;
  /** Short category label for the screen header, e.g. "Honours". */
  topic: string;
};

export const ROUND_COUNT_OPTIONS = [5, 10, 15] as const;
export const DEFAULT_ROUND_COUNT = 10;
