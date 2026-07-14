import {
  applyMove,
  createMatchState,
  decideMatch,
  flagIfExpired,
  liveRemaining,
  nextBoard,
  starterForBoard,
} from '../engine';
import {MATCH_CLOCK_MS, TURN_GRACE_MS} from '../constants';
import type {RankedCell, RankedState} from '../types';

function state(overrides: Partial<RankedState> = {}): RankedState {
  return {
    gameType: 'ranked-hattrick',
    rows: [],
    cols: [],
    board: Array<RankedCell>(9).fill(null),
    players: [
      {userId: 'a', name: 'A', color: '#111'},
      {userId: 'b', name: 'B', color: '#222'},
    ],
    turnUserId: 'a',
    turnStartedAt: 1000,
    firstStarter: 'a',
    clocks: {
      a: {remainingMs: MATCH_CLOCK_MS, out: false},
      b: {remainingMs: MATCH_CLOCK_MS, out: false},
    },
    usedFootballerIds: [],
    boardNumber: 1,
    boardWinner: null,
    matchWinner: null,
    beat: null,
    scores: {a: 0, b: 0},
    signature: 'sig',
    blurs: {},
    ...overrides,
  };
}

describe('turn enforcement', () => {
  it('ignores a move from the player not on turn', () => {
    const next = applyMove(state(), 'b', 0, 'f1', true, 2000);
    expect(next).toEqual(state()); // unchanged
  });

  it('a correct claim keeps the board going and passes the turn', () => {
    const next = applyMove(state(), 'a', 0, 'f1', true, 3000);
    expect(next.board[0]).toEqual({userId: 'a', footballerId: 'f1'});
    expect(next.turnUserId).toBe('b');
    expect(next.usedFootballerIds).toEqual(['f1']);
  });

  it('a wrong answer is a miss that passes the turn', () => {
    const next = applyMove(state(), 'a', 0, undefined, false, 3000);
    expect(next.board[0]).toBeNull();
    expect(next.turnUserId).toBe('b');
    expect(next.beat?.kind).toBe('missed');
  });
});

describe('the chess clock (with a free grace each turn)', () => {
  it('charges nothing inside the grace window', () => {
    const next = applyMove(state({turnStartedAt: 1000}), 'a', 0, 'f1', true, 1000 + TURN_GRACE_MS - 500);
    expect(next.clocks.a.remainingMs).toBe(MATCH_CLOCK_MS);
    expect(next.clocks.b.remainingMs).toBe(MATCH_CLOCK_MS);
  });

  it('charges only the time beyond the grace, and only the mover', () => {
    const next = applyMove(state({turnStartedAt: 1000}), 'a', 0, 'f1', true, 1000 + TURN_GRACE_MS + 3000);
    expect(next.clocks.a.remainingMs).toBe(MATCH_CLOCK_MS - 3000);
    expect(next.clocks.b.remainingMs).toBe(MATCH_CLOCK_MS);
  });

  it('liveRemaining is frozen during the grace, then ticks for the holder only', () => {
    const s = state({turnStartedAt: 1000});
    expect(liveRemaining(s, 'a', 1000 + TURN_GRACE_MS - 100)).toBe(MATCH_CLOCK_MS);
    expect(liveRemaining(s, 'a', 1000 + TURN_GRACE_MS + 5000)).toBe(MATCH_CLOCK_MS - 5000);
    expect(liveRemaining(s, 'b', 1000 + TURN_GRACE_MS + 5000)).toBe(MATCH_CLOCK_MS);
  });

  it('flags the match once the holder is past grace + their clock', () => {
    const s = state({turnStartedAt: 0, clocks: {a: {remainingMs: 2000, out: false}, b: {remainingMs: 5000, out: false}}});
    expect(flagIfExpired(s, TURN_GRACE_MS + 1000).matchWinner).toBeNull(); // still 1s left
    const flagged = flagIfExpired(s, TURN_GRACE_MS + 2500);
    expect(flagged.matchWinner).toBe('b');
    expect(flagged.endReason).toBe('timeout');
    expect(flagged.beat?.kind).toBe('outOfTime');
  });

  it('a move that empties the clock loses the match', () => {
    const s = state({turnStartedAt: 0, clocks: {a: {remainingMs: 1000, out: false}, b: {remainingMs: 9000, out: false}}});
    const next = applyMove(s, 'a', 0, 'f1', true, TURN_GRACE_MS + 2000);
    expect(next.matchWinner).toBe('b');
    expect(next.endReason).toBe('timeout');
    expect(next.board[0]).toBeNull(); // move didn't land — flag fell
  });
});

describe('scoring + boards', () => {
  it('completing a line scores a goal and decides the board', () => {
    const s = state({
      board: [
        {userId: 'a', footballerId: 'f1'},
        {userId: 'a', footballerId: 'f2'},
        null,
        null, null, null, null, null, null,
      ],
    });
    const next = applyMove(s, 'a', 2, 'f3', true, 2000);
    expect(next.boardWinner).toBe('a');
    expect(next.scores.a).toBe(1);
    expect(next.beat?.kind).toBe('goal');
    expect(next.turnUserId).toBe('a'); // held for the host to advance
  });

  it('the starter is random on board 1 and alternates after', () => {
    expect(starterForBoard('a', 'b', 1)).toBe('a');
    expect(starterForBoard('a', 'b', 2)).toBe('b');
    expect(starterForBoard('a', 'b', 3)).toBe('a');
    const s = state({boardNumber: 1, scores: {a: 1, b: 0}});
    const b2 = nextBoard(s, {rows: [], cols: []}, 5000);
    expect(b2.boardNumber).toBe(2);
    expect(b2.turnUserId).toBe('b');
    expect(b2.scores).toEqual({a: 1, b: 0}); // carried
  });

  it('decideMatch: a level tally is a draw, decided on the boards', () => {
    const decided = decideMatch(state({scores: {a: 2, b: 2}, boardNumber: 5}));
    expect(decided.matchWinner).toBe('draw');
    expect(decided.endReason).toBe('boards');
    expect(decided.beat?.kind).toBe('draw');
  });

  it('createMatchState starts both clocks full on the given starter', () => {
    const s = createMatchState(
      [
        {userId: 'a', name: 'A', color: '#111'},
        {userId: 'b', name: 'B', color: '#222'},
      ],
      {rows: [], cols: []},
      'b',
      1000,
    );
    expect(s.turnUserId).toBe('b');
    expect(s.firstStarter).toBe('b');
    expect(s.clocks.a.remainingMs).toBe(MATCH_CLOCK_MS);
  });
});
