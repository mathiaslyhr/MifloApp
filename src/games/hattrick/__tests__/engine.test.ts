import {
  applyMove,
  passTurn,
  proposeTie,
  respondTie,
  validatePick,
} from '../engine';
import type {Criterion} from '../../../data/football';
import type {GridState} from '../types';

const TAG: (t: string) => Criterion = t => ({kind: 'tag', tag: t});

function twoPlayerState(overrides: Partial<GridState> = {}): GridState {
  return {
    gameType: 'hattrick',
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

  it('declares a tie when the board fills with no three-in-a-row', () => {
    // Fill every cell with no line for either side:
    //   A B A
    //   A B B
    //   B A A
    // A takes 0,2,3,7,8 (starter, 5 cells); B takes 1,4,5,6 (4 cells).
    const cells: [number, string][] = [
      [0, 'A'],
      [1, 'B'],
      [2, 'A'],
      [4, 'B'],
      [3, 'A'],
      [5, 'B'],
      [7, 'A'],
      [6, 'B'],
      [8, 'A'],
    ];
    let s = twoPlayerState();
    cells.forEach(([cell, user], i) => {
      // No winner should be declared until the very last cell.
      expect(s.winner).toBeNull();
      s = applyMove(s, cell, `f${i}`, user);
    });
    expect(s.board.every(c => c !== null)).toBe(true);
    expect(s.winner).toBe('tie');
  });
});

describe('passTurn', () => {
  it('advances the turn without claiming a cell', () => {
    const next = passTurn(twoPlayerState(), 'A');
    expect(next.turnUserId).toBe('B');
    expect(next.board.every(c => c === null)).toBe(true);
  });
});

describe('proposeTie / respondTie', () => {
  it('proposing opens an offer the proposer has already accepted', () => {
    const s = proposeTie(twoPlayerState(), 'A');
    expect(s.tieOffer).toEqual({by: 'A', accepted: ['A']});
    expect(s.winner).toBeNull();
  });

  it('ends the game as a tie once every side accepts', () => {
    let s = proposeTie(twoPlayerState(), 'A');
    s = respondTie(s, 'B', true);
    expect(s.winner).toBe('tie');
    // Offer is cleared once resolved.
    expect(s.tieOffer ?? null).toBeNull();
  });

  it('does not tie until the last side accepts (3 players)', () => {
    const three = twoPlayerState({
      sides: [
        {id: 'A', color: '#111', name: 'A', memberUserIds: ['A']},
        {id: 'B', color: '#222', name: 'B', memberUserIds: ['B']},
        {id: 'C', color: '#333', name: 'C', memberUserIds: ['C']},
      ],
      order: ['A', 'B', 'C'],
    });
    let s = proposeTie(three, 'A');
    s = respondTie(s, 'B', true);
    expect(s.winner).toBeNull();
    expect(s.tieOffer?.accepted.sort()).toEqual(['A', 'B']);
    s = respondTie(s, 'C', true);
    expect(s.winner).toBe('tie');
  });

  it('a decline clears the offer without ending the game', () => {
    let s = proposeTie(twoPlayerState(), 'A');
    s = respondTie(s, 'B', false);
    expect(s.winner).toBeNull();
    expect(s.tieOffer ?? null).toBeNull();
  });

  it('accepting is idempotent — re-accepting does not duplicate', () => {
    let s = proposeTie(twoPlayerState(), 'A');
    s = respondTie(s, 'A', true);
    expect(s.tieOffer?.accepted).toEqual(['A']);
  });

  it('proposing is a no-op once the game is decided', () => {
    const s = proposeTie(twoPlayerState({winner: 'A'}), 'B');
    expect(s.tieOffer ?? null).toBeNull();
    expect(s.winner).toBe('A');
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
