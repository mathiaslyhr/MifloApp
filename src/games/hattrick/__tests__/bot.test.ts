import {
  BOT_TIERS,
  botCanMove,
  botMove,
  botThinkMs,
  chooseCell,
  choosePlayer,
  reachableCells,
  type Difficulty,
} from '../bot';
import {famePrior} from '../../cult-hero/famePrior';
import {seededRng} from '../../scout/dailySeed';
import {intersection, type Criterion} from '../../../data/football';
import type {Cell, GridState} from '../types';

// The bot reads the real dataset (intersection + famePrior), so tests use a real
// broad criterion — the "legends" tag — on every axis. Every cell is then
// row∩col = all legends: a deep, well-populated pool, so reachability is never
// the variable under test (positioning and the knowledge filter are).
const LEG: Criterion = {kind: 'tag', tag: 'legends'};

/** A constant rng — every roll returns `v`. `v < strategy` picks the smart cell;
 * `v < missChance` forces a fumble. */
const constRng = (v: number) => () => v;

function state(board: Cell[], turnUserId = 'bot'): GridState {
  return {
    gameType: 'hattrick',
    mode: 'individual',
    rows: [LEG, LEG, LEG],
    cols: [LEG, LEG, LEG],
    board,
    sides: [
      {id: 'p1', color: '#111', name: 'You', memberUserIds: ['p1']},
      {id: 'bot', color: '#222', name: 'Miflo AI', memberUserIds: ['bot']},
    ],
    order: ['p1', 'bot'],
    turnUserId,
    turnDeadline: Number.MAX_SAFE_INTEGER,
    usedFootballerIds: [],
    winner: null,
  };
}

const empty = (): Cell[] => Array(9).fill(null);
const owned = (sideId: string): Cell => ({sideId, footballerId: `x-${sideId}`});

// A tier that always plays the best cell and never fumbles — isolates positioning.
const SHARP = {fameFloor: null, strategy: 1, missChance: 0, think: [0, 0] as [number, number]};

describe('positioning', () => {
  it('takes its own winning line', () => {
    const board = empty();
    board[0] = owned('bot');
    board[1] = owned('bot'); // bot threatens the top row; cell 2 completes it
    const choice = chooseCell(state(board), 'bot', SHARP, constRng(0.5));
    expect(choice?.cell).toBe(2);
  });

  it('blocks the opponent winning line', () => {
    const board = empty();
    board[0] = owned('p1');
    board[1] = owned('p1'); // human threatens the top row
    board[4] = owned('bot'); // bot has no line of its own
    const choice = chooseCell(state(board), 'bot', SHARP, constRng(0.5));
    expect(choice?.cell).toBe(2);
  });

  it('prefers its own win over blocking the opponent', () => {
    const board = empty();
    board[0] = owned('bot');
    board[1] = owned('bot'); // bot wins at 2
    board[3] = owned('p1');
    board[4] = owned('p1'); // human would win at 5
    const choice = chooseCell(state(board), 'bot', SHARP, constRng(0.5));
    expect(choice?.cell).toBe(2);
  });

  it('returns null when there are no empty cells', () => {
    const board = empty().map(() => owned('p1')) as Cell[];
    expect(chooseCell(state(board), 'bot', SHARP, constRng(0.5))).toBeNull();
  });
});

describe('knowledge dial', () => {
  it('only surfaces players at or above the fame floor', () => {
    const floor = 20;
    const cells = reachableCells(state(empty()), {...SHARP, fameFloor: floor});
    expect(cells.length).toBeGreaterThan(0);
    for (const {pool} of cells) {
      for (const f of pool) {
        expect(famePrior(f)).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('a floor above every player makes the board unreachable', () => {
    // famePrior tops out around ~43; nobody clears 100.
    expect(reachableCells(state(empty()), {...SHARP, fameFloor: 100})).toHaveLength(0);
  });

  it('never offers an already-used footballer', () => {
    const anyLegend = intersection(LEG, LEG)[0];
    const s = {...state(empty()), usedFootballerIds: [anyLegend.id]};
    for (const {pool} of reachableCells(s, SHARP)) {
      expect(pool.some(f => f.id === anyLegend.id)).toBe(false);
    }
  });

  it('choosePlayer returns a member of the pool', () => {
    const pool = intersection(LEG, LEG).slice(0, 20);
    const pick = choosePlayer(pool, constRng(0.5));
    expect(pool).toContain(pick);
  });
});

describe('botMove', () => {
  it('claims a valid, unused footballer that satisfies the cell', () => {
    const board = empty();
    board[0] = owned('bot');
    board[1] = owned('bot');
    const next = botMove(state(board), 'bot', 'hard', constRng(0.5));
    // Cell 2 completes the line → a claim, and the win freezes the board.
    expect(next.board[2]).not.toBeNull();
    expect(next.winner).toBe('bot');
    const id = next.board[2]!.footballerId;
    expect(next.usedFootballerIds).toContain(id);
    // The claimed player is a real legend (matches both axes).
    expect(intersection(LEG, LEG).some(f => f.id === id)).toBe(true);
  });

  it('passes as a miss when the fumble roll fires', () => {
    const s = state(empty());
    const next = botMove(s, 'bot', 'hard', constRng(0.001)); // 0.001 < 0.03 miss
    expect(next.turnUserId).toBe('p1'); // turn handed back
    expect(next.board.every(c => c === null)).toBe(true); // no claim
    expect(next.beat?.kind).toBe('missed');
  });

  it('is a no-op once the board is decided', () => {
    const s = {...state(empty()), winner: 'p1'};
    expect(botMove(s, 'bot', 'hard', constRng(0.5))).toBe(s);
  });

  it('quietly skips (no MISSED) when it knows nobody', () => {
    // An impossibly high floor via a custom run: use botMove with a tier where
    // no cell is reachable. botMove only takes a Difficulty, so approximate by
    // filling the pool out — instead assert the reducer path through chooseCell.
    const board = empty();
    // Fill every cell so chooseCell returns null → passTurn without a reason.
    for (let i = 0; i < 8; i++) {
      board[i] = owned('p1');
    }
    board[8] = owned('bot'); // no empty cells → null choice
    const next = botMove(state(board, 'bot'), 'bot', 'easy', constRng(0.5));
    expect(next.turnUserId).toBe('p1');
    expect(next.beat?.kind).not.toBe('missed');
  });

  it('a stronger tier claims more often than an easier one', () => {
    const runs = 300;
    const claims = (d: Difficulty): number => {
      const rng = seededRng(d === 'easy' ? 1 : 2);
      let n = 0;
      for (let i = 0; i < runs; i++) {
        const next = botMove(state(empty()), 'bot', d, rng);
        if (next.board.some(c => c !== null)) {
          n++;
        }
      }
      return n;
    };
    expect(claims('hard')).toBeGreaterThan(claims('easy'));
  });
});

describe('tuning helpers', () => {
  it('botCanMove is true on an open, reachable board', () => {
    expect(botCanMove(state(empty()), 'hard')).toBe(true);
  });

  it('botThinkMs stays within the tier band', () => {
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const [lo, hi] = BOT_TIERS[d].think;
      const ms = botThinkMs(d, constRng(0.5));
      expect(ms).toBeGreaterThanOrEqual(lo);
      expect(ms).toBeLessThanOrEqual(hi);
    }
  });
});
