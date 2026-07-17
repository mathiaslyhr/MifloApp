/**
 * The Hattrick AI opponent — a pure, deliberately *beatable* bot over
 * `GridState`. Solo play against the computer reuses the exact engine reducers a
 * human turn does (`applyMove` / `passTurn` / `validatePick`); this module only
 * decides the bot's move.
 *
 * The bot has two independent competences, and difficulty tunes both:
 *
 *  1. KNOWLEDGE — can it name a valid footballer for a cell. Naming answers is
 *     trivial (the engine already ships `intersection(row, col)`), so the dial
 *     runs the OTHER way: an easier bot only "knows" famous players (high
 *     `famePrior`) and treats obscure cells as unreachable, leaving the deep
 *     answers as the human's edge. Within a cell it names the obvious player.
 *  2. POSITIONING — tic-tac-toe value (take a win → block the opponent's win →
 *     centre → corner → edge). `strategy` is the chance it plays the smart cell
 *     rather than a random reachable one.
 *
 * Plus a per-tier `missChance` so even a cell it could fill sometimes fumbles —
 * the thing that keeps a knowledgeable bot human and losable. Tic-tac-toe is a
 * draw under perfect play, so even Hard tops out at holding a strong human to a
 * draw; it never becomes an unbeatable oracle.
 *
 * Pure and rng-injectable (`rng` defaults to Math.random) so the whole bot is
 * unit-testable with a seeded generator.
 */
import {famePrior} from '../cult-hero/famePrior';
import {intersection, type Footballer, type Rng} from '../../data/football';
import {applyMove, passTurn, sideOfUser, validatePick} from './engine';
import type {GridState} from './types';

export type Difficulty = 'easy' | 'medium' | 'hard';

type Tier = {
  /**
   * Only consider players at least this famous (`famePrior`, ~1..43). A cell
   * whose valid players are all below the floor is "unreachable" for the bot —
   * it hands that cell to the human. `null` = the full pool (knows everyone).
   */
  fameFloor: number | null;
  /** Chance of playing the strategically best cell vs. a random reachable one. */
  strategy: number;
  /** Chance of fumbling a reachable cell (passes as a "MISSED!"). */
  missChance: number;
  /** Think time before the move lands, ms [min, max] — the container waits it. */
  think: [number, number];
};

/**
 * The three handicap presets. Numbers are a playtest starting point, tuned by
 * feel — `famePrior` runs ~1 (unknown) to ~43 (all-time great), so a floor of
 * 22 is "famous only", 12 is "reasonably well known", null is everyone.
 */
export const BOT_TIERS: Record<Difficulty, Tier> = {
  easy: {fameFloor: 22, strategy: 0.15, missChance: 0.35, think: [2500, 4000]},
  medium: {fameFloor: 12, strategy: 0.7, missChance: 0.15, think: [1500, 3000]},
  hard: {fameFloor: null, strategy: 1, missChance: 0.03, think: [1000, 2000]},
};

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

/** Centre first, then corners, then edges — the classic tic-tac-toe ordering. */
const CELL_PREFERENCE = [4, 0, 2, 6, 8, 1, 3, 5, 7] as const;

/** An empty cell the bot could actually claim, with the players it would use. */
type ReachableCell = {cell: number; pool: Footballer[]};

/**
 * The players the bot would consider for one empty cell: everyone valid for
 * `row ∩ col`, minus those already used, minus (unless the tier knows everyone)
 * anyone below the fame floor.
 */
function poolForCell(state: GridState, cell: number, tier: Tier): Footballer[] {
  const row = state.rows[Math.floor(cell / 3)];
  const col = state.cols[cell % 3];
  const used = new Set(state.usedFootballerIds);
  const pool = intersection(row, col).filter(f => !used.has(f.id));
  if (tier.fameFloor == null) {
    return pool;
  }
  return pool.filter(f => famePrior(f) >= tier.fameFloor!);
}

/** Every empty cell the bot can reach at this tier (empty pool → excluded). */
export function reachableCells(state: GridState, tier: Tier): ReachableCell[] {
  const out: ReachableCell[] = [];
  for (let cell = 0; cell < 9; cell++) {
    if (state.board[cell] != null) {
      continue;
    }
    const pool = poolForCell(state, cell, tier);
    if (pool.length > 0) {
      out.push({cell, pool});
    }
  }
  return out;
}

/**
 * The empty cell that would complete a line for `sideId` right now, if it's one
 * the bot can reach. Used both to take the bot's own win and to block the
 * human's — a threat the bot can't fill (no valid player) is not a threat it can
 * stop, so `reachable` gates it.
 */
function completingCell(
  board: GridState['board'],
  sideId: string,
  reachable: Set<number>,
): number | null {
  for (const line of LINES) {
    const owned = line.filter(i => board[i]?.sideId === sideId);
    const empty = line.filter(i => board[i] == null);
    if (owned.length === 2 && empty.length === 1 && reachable.has(empty[0])) {
      return empty[0];
    }
  }
  return null;
}

/** The strategically best reachable cell: win > block > centre > corner > edge. */
function bestCell(
  state: GridState,
  botUserId: string,
  reachable: Set<number>,
): number | null {
  const botSide = sideOfUser(state, botUserId)?.id;
  if (!botSide) {
    return null;
  }
  if (reachable.size === 0) {
    return null;
  }
  const win = completingCell(state.board, botSide, reachable);
  if (win != null) {
    return win;
  }
  // In a 1v1 the opponent is simply the other side.
  const opp = state.sides.find(s => s.id !== botSide)?.id;
  if (opp) {
    const block = completingCell(state.board, opp, reachable);
    if (block != null) {
      return block;
    }
  }
  for (const i of CELL_PREFERENCE) {
    if (reachable.has(i)) {
      return i;
    }
  }
  return null;
}

function pickFrom<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Choose which reachable cell to play. With probability `tier.strategy` the bot
 * plays the best cell; otherwise it plays a random reachable one (an easy bot is
 * mostly random, so it forgets to block and gives lines away).
 */
export function chooseCell(
  state: GridState,
  botUserId: string,
  tier: Tier,
  rng: Rng = Math.random,
): ReachableCell | null {
  const cells = reachableCells(state, tier);
  if (cells.length === 0) {
    return null;
  }
  const byIndex = new Map(cells.map(c => [c.cell, c]));
  if (rng() < tier.strategy) {
    const best = bestCell(state, botUserId, new Set(byIndex.keys()));
    if (best != null) {
      return byIndex.get(best)!;
    }
  }
  return pickFrom(cells, rng);
}

/**
 * Pick a footballer from a cell's pool, weighted toward the famous. The bot
 * names the obvious answer — realistic, and it leaves the obscure valid players
 * for the human to find. (`famePrior²` so the well-known clearly dominate.)
 */
export function choosePlayer(pool: readonly Footballer[], rng: Rng = Math.random): Footballer {
  const weights = pool.map(f => famePrior(f) ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      return pool[i];
    }
  }
  return pool[pool.length - 1];
}

/** Does the bot have any move at all on the current board (for the tie offer)? */
export function botCanMove(
  state: GridState,
  difficulty: Difficulty,
): boolean {
  return reachableCells(state, BOT_TIERS[difficulty]).length > 0;
}

/** Random think delay for this tier, in ms (the container waits it out). */
export function botThinkMs(difficulty: Difficulty, rng: Rng = Math.random): number {
  const [lo, hi] = BOT_TIERS[difficulty].think;
  return Math.round(lo + rng() * (hi - lo));
}

/**
 * The bot's whole turn as a pure reducer: the next `GridState` after it acts.
 * A claim runs `applyMove`; a fumble or a cell it can't reach runs `passTurn`
 * (announced "MISSED!" for a fumble, silent for a genuine "knows nobody" skip).
 * No-op once the board is decided.
 */
export function botMove(
  state: GridState,
  botUserId: string,
  difficulty: Difficulty,
  rng: Rng = Math.random,
): GridState {
  if (state.winner) {
    return state;
  }
  const tier = BOT_TIERS[difficulty];
  const choice = chooseCell(state, botUserId, tier, rng);
  if (!choice) {
    // Nothing the bot knows on this board — a quiet skip (no "MISSED!").
    return passTurn(state, botUserId);
  }
  // A human-like fumble even on a cell it could have filled.
  if (rng() < tier.missChance) {
    return passTurn(state, botUserId, 'missed');
  }
  const pick = choosePlayer(choice.pool, rng);
  // Belt-and-suspenders: the pool is already valid, but never claim on a stale
  // read — fall back to a miss rather than an illegal move.
  if (!pick || !validatePick(state, choice.cell, pick.id)) {
    return passTurn(state, botUserId, 'missed');
  }
  return applyMove(state, choice.cell, pick.id, botUserId);
}
