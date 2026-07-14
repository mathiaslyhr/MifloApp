/**
 * Ranked Hattrick engine — the PURE turn-based reducer + client predictor. The
 * AUTHORITY is the mirrored plpgsql in `supabase/migrations/0036_ranked_turns.sql`;
 * keep the two in parity.
 *
 * Rules: players alternate turns on a per-player chess clock — your clock ticks
 * only during your turn (thinking + searching). Running it to 0 loses the match.
 * 5 boards, three-in-a-row = a goal, draws stand, no tie mechanic. The starter
 * is server-random on board 1 and alternates every board.
 */
import {getById, matches, type Criterion} from '../../data/football';
import {gridSignature, type Grid} from '../hattrick/grid';
import {DEAD_BOARD_TURNS, MATCH_CLOCK_MS, TURN_GRACE_MS} from './constants';
import type {
  RankedBeat,
  RankedBeatKind,
  RankedCell,
  RankedPlayer,
  RankedState,
} from './types';

/** The 8 winning triples on a row-major 3×3 board. */
export const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** The row∩col criteria for a cell index. */
export function cellCriteria(
  state: RankedState,
  cell: number,
): {row: Criterion; col: Criterion} {
  return {row: state.rows[Math.floor(cell / 3)], col: state.cols[cell % 3]};
}

/** Client-side answer check (the dataset lives in the app, not the DB). */
export function validateAnswer(
  state: RankedState,
  cell: number,
  footballerId: string,
): boolean {
  if (state.board[cell]) {
    return false;
  }
  if (state.usedFootballerIds.includes(footballerId)) {
    return false;
  }
  const f = getById(footballerId);
  if (!f) {
    return false;
  }
  const {row, col} = cellCriteria(state, cell);
  return matches(f, row) && matches(f, col);
}

/** Three-in-a-row → winner userId; full board with no line → 'dead'; else null. */
export function computeBoardWinner(board: RankedCell[]): string | 'dead' | null {
  for (const [a, b, c] of LINES) {
    const s = board[a]?.userId;
    if (s && board[b]?.userId === s && board[c]?.userId === s) {
      return s;
    }
  }
  return board.every(cell => cell !== null) ? 'dead' : null;
}

function opponentOf(state: RankedState, userId: string): string | undefined {
  return state.players.find(p => p.userId !== userId)?.userId;
}

function bumpBeat(
  state: RankedState,
  kind: RankedBeatKind,
  userId?: string,
): RankedBeat {
  return {kind, userId, seq: (state.beat?.seq ?? 0) + 1};
}

/** A player's clock right now — the turn-holder's counts down from turnStartedAt. */
export function liveRemaining(
  state: RankedState,
  userId: string,
  now: number,
): number {
  const c = state.clocks[userId];
  if (!c) {
    return 0;
  }
  if (state.turnUserId === userId && !state.matchWinner) {
    // The first TURN_GRACE_MS of a turn is free (read/tap/search/type).
    const burnt = Math.max(0, now - state.turnStartedAt - TURN_GRACE_MS);
    return Math.max(0, c.remainingMs - burnt);
  }
  return c.remainingMs;
}

/**
 * Apply the turn-holder's move: charge their clock, then claim the cell (correct)
 * or record a miss (wrong). A completed line scores + sets the board winner;
 * otherwise the turn passes to the opponent. If the clock empties on the move,
 * the mover loses the match. No-op if it isn't the caller's turn.
 */
export function applyMove(
  state: RankedState,
  userId: string,
  cell: number,
  footballerId: string | undefined,
  correct: boolean,
  now: number,
): RankedState {
  if (state.matchWinner !== null || state.boardWinner !== null) {
    return state;
  }
  if (state.turnUserId !== userId) {
    return state;
  }
  const opp = opponentOf(state, userId);
  // Charge only the time beyond this turn's free grace.
  const spent = Math.max(0, now - state.turnStartedAt - TURN_GRACE_MS);
  const remainingMs = Math.max(0, (state.clocks[userId]?.remainingMs ?? 0) - spent);
  const clocks = {...state.clocks, [userId]: {remainingMs, out: remainingMs <= 0}};
  if (remainingMs <= 0 && opp) {
    // Flag fell mid-move → the mover loses.
    return {
      ...state,
      clocks,
      matchWinner: opp,
      endReason: 'timeout',
      beat: bumpBeat(state, 'outOfTime', userId),
    };
  }

  if (!correct || !footballerId) {
    // Miss → turn passes. If neither player can claim anything for a few turns
    // running, the grid is unsolvable for them: kill it 0-0 rather than let it
    // become a clock trap.
    const noClaimTurns = (state.noClaimTurns ?? 0) + 1;
    const dead = noClaimTurns >= DEAD_BOARD_TURNS;
    return {
      ...state,
      clocks,
      noClaimTurns,
      boardWinner: dead ? 'dead' : state.boardWinner,
      turnUserId: dead ? state.turnUserId : opp ?? state.turnUserId,
      turnStartedAt: now,
      beat: bumpBeat(state, 'missed', userId),
    };
  }

  const board = state.board.slice();
  board[cell] = {userId, footballerId};
  const boardWinner = computeBoardWinner(board);
  const scores = {...state.scores};
  // Only a completed line shouts (GOAL/LEVEL); a plain claim keeps the old beat
  // so no toast fires.
  let beat = state.beat;
  if (boardWinner && boardWinner !== 'dead') {
    scores[boardWinner] = (scores[boardWinner] ?? 0) + 1;
    const levelled = opp !== undefined && scores[boardWinner] === (scores[opp] ?? 0);
    beat = bumpBeat({...state, scores}, levelled ? 'level' : 'goal', boardWinner);
  }
  return {
    ...state,
    board,
    usedFootballerIds: [...state.usedFootballerIds, footballerId],
    clocks,
    scores,
    boardWinner,
    noClaimTurns: 0, // a claim proves the board is alive
    // Board decided → hold turn for the host to advance; else pass turn.
    turnUserId: boardWinner ? state.turnUserId : opp ?? state.turnUserId,
    turnStartedAt: now,
    beat,
  };
}

/** Chess flag: if the turn-holder's clock is spent, the opponent wins. */
export function flagIfExpired(state: RankedState, now: number): RankedState {
  if (state.matchWinner !== null) {
    return state;
  }
  const holder = state.turnUserId;
  const remaining = liveRemaining(state, holder, now);
  if (remaining > 0) {
    return state;
  }
  const opp = opponentOf(state, holder);
  if (!opp) {
    return state;
  }
  return {
    ...state,
    clocks: {...state.clocks, [holder]: {remainingMs: 0, out: true}},
    matchWinner: opp,
    endReason: 'timeout',
    beat: bumpBeat(state, 'outOfTime', holder),
  };
}

/** The board-1 starter is random; board k alternates from it. */
export function starterForBoard(
  firstStarter: string,
  opponent: string,
  boardNumber: number,
): string {
  return boardNumber % 2 === 1 ? firstStarter : opponent;
}

/** Fresh initial state for board 1. `firstStarter` is chosen by the server. */
export function createMatchState(
  players: RankedPlayer[],
  grid: Grid,
  firstStarter: string,
  now: number,
): RankedState {
  const clocks: Record<string, {remainingMs: number; out: boolean}> = {};
  const scores: Record<string, number> = {};
  for (const p of players) {
    clocks[p.userId] = {remainingMs: MATCH_CLOCK_MS, out: false};
    scores[p.userId] = 0;
  }
  return {
    gameType: 'ranked-hattrick',
    rows: grid.rows,
    cols: grid.cols,
    board: Array(9).fill(null),
    players,
    turnUserId: firstStarter,
    turnStartedAt: now,
    firstStarter,
    clocks,
    scores,
    usedFootballerIds: [],
    boardNumber: 1,
    boardWinner: null,
    noClaimTurns: 0,
    matchWinner: null,
    beat: null,
    signature: gridSignature(grid),
    blurs: {},
  };
}

/** Load the next board (host generates the grid). Carries scores + clocks; the
 * starter alternates and the clock restarts for them. */
export function nextBoard(state: RankedState, grid: Grid, now: number): RankedState {
  const boardNumber = state.boardNumber + 1;
  const opp = opponentOf(state, state.firstStarter) ?? state.firstStarter;
  const turnUserId = starterForBoard(state.firstStarter, opp, boardNumber);
  return {
    ...state,
    rows: grid.rows,
    cols: grid.cols,
    board: Array(9).fill(null),
    boardNumber,
    boardWinner: null,
    noClaimTurns: 0,
    turnUserId,
    turnStartedAt: now,
    signature: gridSignature(grid),
  };
}

/** Decide the match from the goal tally (leader, or 'draw' — draws stand). */
export function decideMatch(state: RankedState): RankedState {
  const [p1, p2] = state.players;
  const s1 = state.scores[p1.userId] ?? 0;
  const s2 = state.scores[p2.userId] ?? 0;
  const matchWinner = s1 === s2 ? 'draw' : s1 > s2 ? p1.userId : p2.userId;
  const beat = bumpBeat(
    state,
    matchWinner === 'draw' ? 'draw' : 'winner',
    matchWinner === 'draw' ? undefined : matchWinner,
  );
  return {...state, matchWinner, endReason: 'boards', beat};
}
