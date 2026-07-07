/**
 * Tic-Tac-Toe game logic — pure functions over `GridState`. Runs identically on
 * every device (the player whose turn it is computes the next state and sends it
 * via `play_move`; the server only checks it's their turn).
 */
import {getById, matches} from '../../data/football';
import {gridSignature, type Grid} from './grid';
import type {Cell, GridState, Side} from './types';

/** Distinct side colours (individual mode uses one per player). */
export const PALETTE = [
  '#6260F6', // brand purple
  '#F0544A', // red
  '#32C36C', // green
  '#F2913D', // orange
  '#3DA5F2', // blue
  '#B45AF2', // violet
  '#F25AA8', // pink
  '#F5C451', // amber
];

/** Seconds each player gets to make a move before their turn passes. */
export const TURN_SECONDS = 120;
const TURN_MS = TURN_SECONDS * 1000;

/** Fisher–Yates shuffle (used to randomise who starts). */
function shuffled<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LINES: readonly number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

type RosterEntry = {userId: string; name: string};

/** Build the initial state for Individual mode from the grid + roster. */
export function createIndividualState(
  grid: Grid,
  roster: RosterEntry[],
  opts: {avoidStarter?: string} = {},
): GridState {
  // Randomise the turn order so the starter isn't always the host. If the same
  // player would start again (avoidStarter), swap them out of the lead so the
  // opener rotates round-to-round.
  const order = shuffled(roster.map(p => p.userId));
  if (opts.avoidStarter && order.length > 1 && order[0] === opts.avoidStarter) {
    const swapWith = 1 + Math.floor(Math.random() * (order.length - 1));
    [order[0], order[swapWith]] = [order[swapWith], order[0]];
  }
  const sides: Side[] = roster.map((p, i) => ({
    id: p.userId,
    color: PALETTE[i % PALETTE.length],
    name: p.name,
    memberUserIds: [p.userId],
  }));
  return {
    gameType: 'tic-tac-toe',
    mode: 'individual',
    rows: grid.rows,
    cols: grid.cols,
    board: Array(9).fill(null) as Cell[],
    sides,
    order,
    turnUserId: order[0],
    turnDeadline: Date.now() + TURN_MS,
    usedFootballerIds: [],
    winner: null,
    signature: gridSignature(grid),
  };
}

/** The row + col criteria that meet at a cell. */
export function cellCriteria(state: GridState, cellIndex: number) {
  return {row: state.rows[Math.floor(cellIndex / 3)], col: state.cols[cellIndex % 3]};
}

/** The side a user plays for (individual: themselves; teams: their team). */
export function sideOfUser(state: GridState, userId: string): Side | undefined {
  return state.sides.find(s => s.memberUserIds.includes(userId));
}

/** Is this footballer a valid claim for this cell? */
export function validatePick(
  state: GridState,
  cellIndex: number,
  footballerId: string,
): boolean {
  if (state.winner || state.board[cellIndex]) {
    return false;
  }
  if (state.usedFootballerIds.includes(footballerId)) {
    return false;
  }
  const f = getById(footballerId);
  if (!f) {
    return false;
  }
  const {row, col} = cellCriteria(state, cellIndex);
  return matches(f, row) && matches(f, col);
}

function nextTurn(order: string[], current: string): string {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

function computeWinner(board: Cell[], _sidesUnused?: Side[]): string | 'tie' | null {
  for (const [a, b, c] of LINES) {
    const s = board[a]?.sideId;
    if (s && board[b]?.sideId === s && board[c]?.sideId === s) {
      return s;
    }
  }
  if (board.every(cell => cell !== null)) {
    // Board full with no three-in-a-row: nobody connected a line, so it's a tie.
    // (Cell counts are irrelevant — winning requires an actual line.)
    return 'tie';
  }
  return null;
}

/** Claim a cell for `userId`'s side and advance the turn. Assumes a valid pick. */
export function applyMove(
  state: GridState,
  cellIndex: number,
  footballerId: string,
  userId: string,
): GridState {
  const side = sideOfUser(state, userId);
  if (!side) {
    return state;
  }
  const board = state.board.slice();
  board[cellIndex] = {sideId: side.id, footballerId};
  // A full board with no three-in-a-row is a genuine 'tie'.
  const winner = computeWinner(board);
  return {
    ...state,
    board,
    usedFootballerIds: [...state.usedFootballerIds, footballerId],
    winner,
    turnUserId: winner ? state.turnUserId : nextTurn(state.order, userId),
    turnDeadline: winner ? state.turnDeadline : Date.now() + TURN_MS,
  };
}

/** A wrong guess or a timeout: no claim, the turn simply passes on. */
export function passTurn(state: GridState, userId: string): GridState {
  if (state.winner) {
    return state;
  }
  return {
    ...state,
    turnUserId: nextTurn(state.order, userId),
    turnDeadline: Date.now() + TURN_MS,
  };
}

/**
 * Propose ending the game in a mutual tie (used when nobody knows another
 * answer). The proposer implicitly accepts; a fresh proposal replaces any
 * pending one. Any player may propose, not just the turn-holder. No-op once the
 * game is decided.
 */
export function proposeTie(state: GridState, userId: string): GridState {
  if (state.winner) {
    return state;
  }
  const side = sideOfUser(state, userId);
  if (!side) {
    return state;
  }
  return finalizeTie(state, {by: side.id, accepted: [side.id]});
}

/**
 * Respond to a pending tie offer. Accepting adds the side to the tally and — once
 * every side has accepted — ends the game as `winner: 'tie'`. Declining clears
 * the offer so play resumes. No-op if there's no offer or the game is decided.
 */
export function respondTie(
  state: GridState,
  userId: string,
  accept: boolean,
): GridState {
  if (state.winner || !state.tieOffer) {
    return state;
  }
  const side = sideOfUser(state, userId);
  if (!side) {
    return state;
  }
  if (!accept) {
    return {...state, tieOffer: null};
  }
  const accepted = state.tieOffer.accepted.includes(side.id)
    ? state.tieOffer.accepted
    : [...state.tieOffer.accepted, side.id];
  return finalizeTie(state, {...state.tieOffer, accepted});
}

/** Apply a tie offer, collapsing to `winner: 'tie'` once all sides have accepted. */
function finalizeTie(state: GridState, offer: NonNullable<GridState['tieOffer']>): GridState {
  const everyoneAccepted = state.sides.every(s => offer.accepted.includes(s.id));
  if (everyoneAccepted) {
    return {...state, winner: 'tie', tieOffer: null};
  }
  return {...state, tieOffer: offer};
}
