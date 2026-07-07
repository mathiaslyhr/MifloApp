import {
  advanceAsk,
  applyRedemption,
  buildFootballerPool,
  eligibleFootballerIds,
  setAskTarget,
  tally,
} from '../engine';
import {getById} from '../../../data/football';
import {MIN_POOL, ROUNDS, SCORE} from '../types';
import type {ImposterState} from '../types';

function state(overrides: Partial<ImposterState> = {}): ImposterState {
  return {
    gameType: 'footballer-imposter',
    phase: 'asking',
    round: 1,
    order: ['a', 'b', 'c'],
    turnUserId: 'a',
    askTargetUserId: null,
    players: [
      {userId: 'a', name: 'A'},
      {userId: 'b', name: 'B'},
      {userId: 'c', name: 'C'},
    ],
    votedCount: 0,
    scores: {a: 0, b: 0, c: 0},
    ...overrides,
  };
}

describe('advanceAsk', () => {
  it('cycles all players across two rounds, then moves to voting', () => {
    let s = state();
    // Round 1: a -> b -> c
    s = advanceAsk(s);
    expect(s).toMatchObject({round: 1, turnUserId: 'b'});
    s = advanceAsk(s);
    expect(s).toMatchObject({round: 1, turnUserId: 'c'});
    // Wrap into round 2, back to the first asker.
    s = advanceAsk(s);
    expect(s).toMatchObject({round: 2, turnUserId: 'a'});
    s = advanceAsk(s);
    expect(s).toMatchObject({round: 2, turnUserId: 'b'});
    s = advanceAsk(s);
    expect(s).toMatchObject({round: 2, turnUserId: 'c'});
    // After the final asker of the final round → voting.
    s = advanceAsk(s);
    expect(s.phase).toBe('voting');
    expect(ROUNDS).toBe(2);
  });

  it('clears the ask target each step', () => {
    const s = advanceAsk(setAskTarget(state(), 'b'));
    expect(s.askTargetUserId).toBeNull();
  });

  it('is a no-op outside the asking phase', () => {
    const s = state({phase: 'voting'});
    expect(advanceAsk(s)).toBe(s);
  });
});

describe('tally', () => {
  const ids = ['a', 'b', 'c'];
  const zero = {a: 0, b: 0, c: 0};

  it('catches the imposter and rewards each detective who voted for them', () => {
    // imposter = b; a and c both vote b, b votes a.
    const {caught, deltas, scores} = tally(
      {a: 'b', c: 'b', b: 'a'},
      'b',
      ids,
      zero,
    );
    expect(caught).toBe(true);
    expect(deltas).toEqual({a: SCORE.detectiveCorrect, b: 0, c: SCORE.detectiveCorrect});
    expect(scores).toEqual({a: 1, b: 0, c: 1});
  });

  it('awards the imposter the escape bonus when the majority misses', () => {
    // imposter = b; the group piles onto c.
    const {caught, deltas, scores} = tally(
      {a: 'c', b: 'c', c: 'a'},
      'b',
      ids,
      zero,
    );
    expect(caught).toBe(false);
    expect(deltas).toEqual({a: 0, b: SCORE.imposterEscape, c: 0});
    expect(scores).toEqual({a: 0, b: 3, c: 0});
  });

  it('counts a tie at the top as caught (generous to detectives)', () => {
    // Every target gets one vote; the imposter is among the tied max.
    const {caught, deltas} = tally({a: 'b', b: 'c', c: 'a'}, 'b', ids, zero);
    expect(caught).toBe(true);
    expect(deltas).toEqual({a: SCORE.detectiveCorrect, b: 0, c: 0});
  });

  it('adds this hand to prior running totals', () => {
    const {scores} = tally({a: 'b', c: 'b', b: 'a'}, 'b', ids, {a: 5, b: 2, c: 0});
    expect(scores).toEqual({a: 6, b: 2, c: 1});
  });
});

describe('applyRedemption', () => {
  it('adds the redeem bonus to the imposter on a correct guess', () => {
    expect(applyRedemption({b: 0}, 'b', true)).toEqual({b: SCORE.imposterRedeem});
  });

  it('leaves scores untouched on a wrong guess', () => {
    const scores = {b: 3};
    expect(applyRedemption(scores, 'b', false)).toBe(scores);
  });
});

describe('buildFootballerPool', () => {
  it('returns only illustrated players that exist in the dataset', () => {
    const eligible = eligibleFootballerIds();
    const pool = buildFootballerPool(() => 0.42);
    expect(pool).toHaveLength(eligible.length);
    expect(new Set(pool)).toEqual(new Set(eligible));
    // Every candidate resolves to a real footballer (the reveal shows a portrait).
    expect(pool.every(id => getById(id) !== undefined)).toBe(true);
  });

  it('offers enough candidates to satisfy the server floor', () => {
    expect(buildFootballerPool().length).toBeGreaterThanOrEqual(MIN_POOL);
  });
});
