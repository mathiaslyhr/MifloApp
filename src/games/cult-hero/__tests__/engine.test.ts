import {advanceRoundReveal, computeScores, nameOf, standings} from '../engine';
import type {CultHeroResult, CultHeroState} from '../types';

/** The worked example from the design: a Real Madrid prompt on day one. */
const ELIGIBLE = [
  {id: 'ronaldo', w: 15},
  {id: 'zidane', w: 10},
  {id: 'benzema', w: 7.5},
  {id: 'ramos', w: 5},
  {id: 'casillas', w: 4},
  {id: 'marcelo', w: 3},
  {id: 'isco', w: 2},
  {id: 'arbeloa', w: 1.5},
  {id: 'cambiasso', w: 1},
  {id: 'sahin', w: 1},
];

function state(overrides: Partial<CultHeroState> = {}): CultHeroState {
  return {
    gameType: 'cult-hero',
    phase: 'answering',
    round: 1,
    rounds: 3,
    promptKeys: ['club:real-madrid', 'nat:Brazil', 'honour:world-cup'],
    turnUserId: null,
    players: [
      {userId: 'a', name: 'A'},
      {userId: 'b', name: 'B'},
    ],
    answeredCount: 0,
    revealIndex: 0,
    scores: {a: 0, b: 0},
    ...overrides,
  };
}

const results: CultHeroResult[] = [
  {userId: 'a', footballerId: 'ronaldo', valid: true, score: 0},
  {userId: 'b', footballerId: 'sahin', valid: true, score: 89},
];

function revealState(overrides: Partial<CultHeroState> = {}): CultHeroState {
  return state({
    phase: 'roundReveal',
    turnUserId: 'a',
    answeredCount: 2,
    results,
    revealIndex: 0,
    ...overrides,
  });
}

describe('computeScores', () => {
  it('scores the day-one worked example', () => {
    const scored = computeScores(ELIGIBLE, {}, [
      {userId: 'a', footballerId: 'ronaldo'},
      {userId: 'b', footballerId: 'ronaldo'},
      {userId: 'c', footballerId: 'sahin'},
      {userId: 'd', footballerId: 'gerrard'},
    ]);
    // Most famous valid answer scores 0 — pure Pointless.
    expect(scored[0]).toEqual({userId: 'a', footballerId: 'ronaldo', valid: true, score: 0});
    // In-room duplicates get the identical score.
    expect(scored[1].score).toBe(0);
    expect(scored[1].valid).toBe(true);
    // Şahin: 8 heavier players (Cambiasso ties, ties don't count) → 89.
    expect(scored[2]).toEqual({userId: 'c', footballerId: 'sahin', valid: true, score: 89});
    // Gerrard never played there: invalid, 0 points.
    expect(scored[3]).toEqual({userId: 'd', footballerId: 'gerrard', valid: false, score: 0});
  });

  it('scores tied weights identically', () => {
    const scored = computeScores(ELIGIBLE, {}, [
      {userId: 'a', footballerId: 'cambiasso'},
      {userId: 'b', footballerId: 'sahin'},
    ]);
    expect(scored[0].score).toBe(scored[1].score);
  });

  it('lets observed global picks overturn the prior', () => {
    // Casillas (4+25) becomes heavier than Ramos (5+20), flipping their order.
    const picks = {ronaldo: 180, zidane: 60, benzema: 45, casillas: 25, ramos: 20};
    const scored = computeScores(ELIGIBLE, picks, [
      {userId: 'a', footballerId: 'casillas'},
      {userId: 'b', footballerId: 'ramos'},
    ]);
    expect(scored[1].score).toBeGreaterThan(scored[0].score);
  });

  it('gives the uniquely rarest answer 100', () => {
    const eligible = [
      {id: 'famous', w: 10},
      {id: 'known', w: 5},
      {id: 'cult', w: 1},
    ];
    const scored = computeScores(eligible, {}, [{userId: 'a', footballerId: 'cult'}]);
    expect(scored[0].score).toBe(100);
  });
});

describe('advanceRoundReveal', () => {
  it('does nothing outside roundReveal', () => {
    const s = state();
    expect(advanceRoundReveal(s)).toBe(s);
  });

  it('pages to the next result', () => {
    const next = advanceRoundReveal(revealState());
    expect(next.revealIndex).toBe(1);
    expect(next.phase).toBe('roundReveal');
  });

  it('rolls past the last result into the round leaderboard, host keeping the turn', () => {
    const next = advanceRoundReveal(revealState({revealIndex: 1}));
    expect(next.phase).toBe('leaderboard');
    expect(next.turnUserId).toBe('a');
    expect(next.results).toEqual(results);
  });

  it('rolls from the leaderboard into the next round', () => {
    const next = advanceRoundReveal(
      revealState({phase: 'leaderboard', revealIndex: 1}),
    );
    expect(next.phase).toBe('answering');
    expect(next.round).toBe(2);
    expect(next.answeredCount).toBe(0);
    expect(next.revealIndex).toBe(0);
    expect(next.turnUserId).toBeNull();
    expect(next.results).toBeUndefined();
  });

  it('rolls past the final round straight into the final standings, keeping results', () => {
    const next = advanceRoundReveal(revealState({round: 3, revealIndex: 1}));
    expect(next.phase).toBe('final');
    expect(next.turnUserId).toBeNull();
    expect(next.results).toEqual(results);
  });

  it('rolls a final-round leaderboard into the final standings (defensive)', () => {
    const next = advanceRoundReveal(
      revealState({phase: 'leaderboard', round: 3, revealIndex: 1}),
    );
    expect(next.phase).toBe('final');
    expect(next.turnUserId).toBeNull();
  });
});

describe('standings & nameOf', () => {
  it('sorts players by running score, best first', () => {
    const s = state({scores: {a: 89, b: 133}});
    expect(standings(s)).toEqual([
      {userId: 'b', name: 'B', score: 133},
      {userId: 'a', name: 'A', score: 89},
    ]);
  });

  it('resolves display names with a safe fallback', () => {
    const s = state();
    expect(nameOf(s, 'a')).toBe('A');
    expect(nameOf(s, 'ghost')).toBe('');
  });
});
