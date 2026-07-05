import {applyMove, passTurn, validatePick} from '../engine';
import type {Criterion} from '../../../data/football';
import type {GridState} from '../types';

const TAG: (t: string) => Criterion = t => ({kind: 'tag', tag: t});

function twoPlayerState(overrides: Partial<GridState> = {}): GridState {
  return {
    gameType: 'tic-tac-toe',
    mode: 'individual',
    rows: [TAG('r0'), TAG('r1'), TAG('r2')],
    cols: [TAG('c0'), TAG('c1'), TAG('c2')],
    board: Array(9).fill(null),
    sides: [
      {id: 'A', color: '#111', name: 'A', memberUserIds: ['A']},
      {id: 'B', color: '#222', name: 'B', memberUserIds: ['B']},
    ],
    order: ['A', 'B'],
    turnUserId: 'A',
    turnDeadline: Number.MAX_SAFE_INTEGER,
    usedFootballerIds: [],
    winner: null,
    ...overrides,
  };
}

describe('applyMove', () => {
  it('claims the cell for the mover and advances the turn', () => {
    const next = applyMove(twoPlayerState(), 0, 'f1', 'A');
    expect(next.board[0]).toEqual({sideId: 'A', footballerId: 'f1'});
    expect(next.turnUserId).toBe('B');
    expect(next.usedFootballerIds).toContain('f1');
  });

  it('detects a three-in-a-row winner', () => {
    let s = twoPlayerState();
    s = applyMove(s, 0, 'f1', 'A'); // A
    s = applyMove(s, 3, 'f2', 'B'); // B
    s = applyMove(s, 1, 'f3', 'A'); // A
    s = applyMove(s, 4, 'f4', 'B'); // B
    s = applyMove(s, 2, 'f5', 'A'); // A → top row
    expect(s.winner).toBe('A');
  });
});

describe('passTurn', () => {
  it('advances the turn without claiming a cell', () => {
    const next = passTurn(twoPlayerState(), 'A');
    expect(next.turnUserId).toBe('B');
    expect(next.board.every(c => c === null)).toBe(true);
  });
});

describe('validatePick', () => {
  it('accepts a footballer matching both axes and rejects reuse', () => {
    // Cell 0 = Argentina ∩ Man City → Sergio Agüero qualifies.
    const s = twoPlayerState({
      rows: [{kind: 'nationality', country: 'Argentina'}, TAG('r1'), TAG('r2')],
      cols: [{kind: 'club', clubId: 'man-city'}, TAG('c1'), TAG('c2')],
    });
    expect(validatePick(s, 0, 'Agüero, Sergio')).toBe(true);
    expect(validatePick(s, 0, 'does-not-exist')).toBe(false);

    const used = {...s, usedFootballerIds: ['Agüero, Sergio']};
    expect(validatePick(used, 0, 'Agüero, Sergio')).toBe(false);
  });
});
