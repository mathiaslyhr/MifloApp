import {
  advanceBoard,
  applyMove,
  createNextBoardState,
  createRematchState,
  matchScores,
  passTurn,
  proposeTie,
  respondTie,
  surrender,
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

/** Play A to a top-row win from a fresh-ish state. */
function winBoard(s: GridState): GridState {
  s = applyMove(s, 0, `f${Math.random()}`, 'A');
  s = applyMove(s, 3, `f${Math.random()}`, 'B');
  s = applyMove(s, 1, `f${Math.random()}`, 'A');
  s = applyMove(s, 4, `f${Math.random()}`, 'B');
  return applyMove(s, 2, `f${Math.random()}`, 'A');
}

describe('match scores + commentary beats', () => {
  it('a won board scores a goal and announces GOAL for the scorer', () => {
    const s = winBoard(twoPlayerState());
    expect(matchScores(s)).toEqual({A: 1, B: 0});
    expect(s.beat).toEqual({kind: 'goal', sideId: 'A', seq: 1});
    expect(s.matchWinner ?? null).toBeNull();
  });

  it('a goal that pulls the scores level announces LEVEL', () => {
    const s = winBoard(
      twoPlayerState({scores: {A: 0, B: 1}, boardNumber: 2}),
    );
    expect(matchScores(s)).toEqual({A: 1, B: 1});
    expect(s.beat?.kind).toBe('level');
    expect(s.beat?.sideId).toBe('A');
  });

  it('never crowns a match winner — friendlies are open-ended', () => {
    // A board win at a high board number is still just a GOAL, not a WINNER:
    // the tally climbs and the match keeps going.
    const s = winBoard(
      twoPlayerState({scores: {A: 1, B: 1}, boardNumber: 5}),
    );
    expect(matchScores(s)).toEqual({A: 2, B: 1});
    expect(s.matchWinner ?? null).toBeNull();
    expect(s.beat?.kind).toBe('goal');
    expect(s.beat?.sideId).toBe('A');
  });

  it('a levelling goal at any board number is a LEVEL, never a DRAW-decided match', () => {
    const s = winBoard(
      twoPlayerState({scores: {A: 0, B: 1}, boardNumber: 5}),
    );
    expect(matchScores(s)).toEqual({A: 1, B: 1});
    expect(s.matchWinner ?? null).toBeNull();
    expect(s.beat?.kind).toBe('level');
  });

  it('an agreed tie at any board number settles the board, never the match', () => {
    let s = twoPlayerState({scores: {A: 2, B: 0}, boardNumber: 5});
    s = proposeTie(s, 'A');
    s = respondTie(s, 'B', true);
    expect(s.winner).toBe('tie');
    expect(s.matchWinner ?? null).toBeNull();
    expect(matchScores(s)).toEqual({A: 2, B: 0});
  });

  it('a mid-match board tie scores nobody and stays quiet', () => {
    let s = twoPlayerState({scores: {A: 1, B: 0}, boardNumber: 2});
    s = proposeTie(s, 'A');
    s = respondTie(s, 'B', true);
    expect(matchScores(s)).toEqual({A: 1, B: 0});
    expect(s.matchWinner ?? null).toBeNull();
    expect(s.beat ?? null).toBeNull();
  });

  it('a wrong answer announces MISSED and a timeout OUT OF TIME', () => {
    const missed = passTurn(twoPlayerState(), 'A', 'missed');
    expect(missed.beat).toEqual({kind: 'missed', sideId: 'A', seq: 1});
    const timedOut = passTurn(missed, 'B', 'timeout');
    expect(timedOut.beat).toEqual({kind: 'timeout', sideId: 'B', seq: 2});
    // A deliberate skip stays quiet (keeps the last beat, no replay: same seq).
    const skipped = passTurn(timedOut, 'A');
    expect(skipped.beat).toEqual(timedOut.beat);
  });

  it('the next board carries the scoreline and beat seq; advanceBoard always advances', () => {
    const done = winBoard(twoPlayerState({scores: {A: 0, B: 2}, boardNumber: 3}));
    const next = createNextBoardState(done);
    expect(matchScores(next)).toEqual({A: 1, B: 2});
    expect(next.boardNumber).toBe(4);
    expect(next.winner).toBeNull();
    // The finished board's beat rides along unchanged — clients de-dupe on seq.
    expect(next.beat).toEqual(done.beat);

    // Open-ended: advanceBoard always moves to the next board, carrying the
    // tally — there is no match end to reset to.
    const advanced = advanceBoard(done);
    expect(advanced.boardNumber).toBe(4);
    expect(matchScores(advanced)).toEqual({A: 1, B: 2});
  });
});

describe('createRematchState', () => {
  it('resets the board for the same players, rotating the starter and grid', () => {
    const finished = twoPlayerState({
      winner: 'A',
      board: Array(9).fill({sideId: 'A', footballerId: 'f1'}),
      usedFootballerIds: ['f1'],
      signature: 'prev-signature',
    });
    const next = createRematchState(finished);
    expect(next.sides.map(s => s.id).sort()).toEqual(['A', 'B']);
    expect(next.board.every(cell => cell === null)).toBe(true);
    expect(next.usedFootballerIds).toEqual([]);
    expect(next.winner).toBeNull();
    // Two players: the previous starter never opens twice in a row.
    expect(next.order[0]).not.toBe(finished.order[0]);
    expect(next.signature).toBeDefined();
    expect(next.signature).not.toBe(finished.signature);
  });
});

describe('surrender', () => {
  it('ends the board for the opponent and flags the reason', () => {
    const next = surrender(twoPlayerState({turnUserId: 'A'}), 'A');
    expect(next.winner).toBe('B'); // the other side takes the board
    expect(next.endReason).toBe('surrender');
  });

  it('does not move the score (a concession is not a played goal)', () => {
    const s = twoPlayerState({scores: {A: 2, B: 1}});
    const next = surrender(s, 'A');
    expect(matchScores(next)).toEqual({A: 2, B: 1});
  });

  it('is a no-op once the board is already decided', () => {
    const s = twoPlayerState({winner: 'A'});
    expect(surrender(s, 'B')).toBe(s);
  });

  it('clears any pending tie offer', () => {
    const s = twoPlayerState({tieOffer: {by: 'A', accepted: ['A']}});
    expect(surrender(s, 'A').tieOffer).toBeNull();
  });
});
