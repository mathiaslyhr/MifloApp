/**
 * Missing XI config + shared domain types. A question is one famous lineup with
 * a single slot hidden; players type the missing name. The deck is built by the
 * host and broadcast, so a question is self-contained (it carries the full
 * lineup incl. the hidden player's aliases) and plain JSON.
 */
import type {LineupPlayer} from '../../data/football';

export type MissingQuestion = {
  lineupId: string;
  team: string;
  competition: string;
  year: number;
  formation: string;
  /** All eleven players, in lineup order. */
  players: LineupPlayer[];
  /** Index into `players` of the hidden slot — the one to guess. */
  hiddenIndex: number;
};

export const QUESTION_COUNT_OPTIONS = [5, 10, 15] as const;
export const DEFAULT_QUESTION_COUNT = 10;
