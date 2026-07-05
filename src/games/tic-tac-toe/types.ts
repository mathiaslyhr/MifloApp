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
  gameType: 'tic-tac-toe';
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
  /** Winning sideId, 'tie', or null while in progress. */
  winner: string | 'tie' | null;
};
