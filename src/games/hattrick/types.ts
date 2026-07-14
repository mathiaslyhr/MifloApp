/**
 * Tic-Tac-Toe (football grid) shared types. This is the whole game state stored
 * on the room (`rooms.game_state`) and rendered identically on every device.
 *
 * A "side" owns cells and wins. Individual mode = one side per player; Teams
 * mode (Phase B) = two sides with many members. The board/turn/win logic is the
 * same either way — only the number of sides and the turn `order` differ.
 */
import type {Criterion} from '../../data/football';

export type Mode = 'individual' | 'teams';

export type Side = {
  /** Stable id: the player's userId (individual) or 'A'/'B' (teams). */
  id: string;
  /** Cell/label colour (hex). */
  color: string;
  /** Display name — player nickname (individual) or team name (teams). */
  name: string;
  /** Users on this side. */
  memberUserIds: string[];
};

/** A claimed cell, or null if empty. */
export type Cell = {sideId: string; footballerId: string} | null;

export type GridState = {
  gameType: 'hattrick';
  mode: Mode;
  /** 3 row criteria and 3 column criteria; a cell = row ∩ col. */
  rows: Criterion[];
  cols: Criterion[];
  /** 9 cells, row-major (index = row*3 + col). */
  board: Cell[];
  sides: Side[];
  /** Flat turn order of userIds; advances one step per move. */
  order: string[];
  turnUserId: string;
  /** Epoch ms by which the current player must move; resets each turn. */
  turnDeadline: number;
  /** Footballers already used this game — can't be reused. */
  usedFootballerIds: string[];
  /** Winning sideId, 'tie', or null while in progress — for THIS board. */
  winner: string | 'tie' | null;
  /**
   * Goals per sideId across the match (a won board = a goal). Absent on
   * states written before matches existed — read via `matchScores()`.
   */
  scores?: Record<string, number>;
  /** 1-based board number within the match (a match = MATCH_BOARDS boards). */
  boardNumber?: number;
  /**
   * The decided match: the leading sideId after the final board, or 'draw'
   * when the scores are level. Null/absent while boards remain.
   */
  matchWinner?: string | 'draw' | null;
  /**
   * The latest commentary beat — synced state, so every device renders the
   * same moment ("GOAL! …", "MISSED!"). Clients de-dupe on `seq`; the beat is
   * carried (not cleared) between boards so the sequence stays comparable.
   */
  beat?: Beat | null;
  /**
   * A pending "agree to a tie" offer. Any player may propose (e.g. when nobody
   * knows another answer); the proposer pre-accepts. When every side has
   * accepted, the game ends as `winner: 'tie'`. A decline clears the offer.
   * Absent/null when no offer is on the table.
   */
  tieOffer?: TieOffer | null;
  /** Order-independent fingerprint of the grid's axes (repeat-avoidance). */
  signature?: string;
};

/** A live proposal to end the game in a mutual tie. */
export type TieOffer = {
  /** sideId that proposed. */
  by: string;
  /** sideIds that have accepted (includes the proposer). */
  accepted: string[];
};

/** The commentary vocabulary. ("TAKEN" waits for a simultaneous-claim mode —
 * Hattrick is strictly turn-based, so no lock race exists to announce.) */
export type BeatKind =
  | 'goal' // a line completed → a goal for that side
  | 'level' // a goal that brings the scores level
  | 'winner' // the match decided after the final board
  | 'draw' // final board done with level scores
  | 'missed' // a wrong answer (turn passes)
  | 'timeout'; // the turn clock ran out (turn passes)

/** One synced commentary moment, rendered identically on every device. */
export type Beat = {
  kind: BeatKind;
  /** The side the beat is about (name/color lookups); absent for neutral beats. */
  sideId?: string;
  /** Monotonic-enough counter; clients replay a beat only when seq changes. */
  seq: number;
};
