import {famePrior, normalizePriors} from '../famePrior';
import {PSEUDO_PER_PLAYER} from '../types';
import type {Footballer} from '../../../data/football';

/** A synthetic dataset row; famePrior is a pure function of the fields. */
function player(overrides: Partial<Footballer> = {}): Footballer {
  return {
    id: 'Test, Player',
    name: 'Test Player',
    nationality: ['England'],
    positions: ['MF'],
    born: '1990-01-01',
    clubs: [],
    honours: [],
    ...overrides,
  };
}

describe('famePrior', () => {
  it('gives a blank journeyman the floor value of 1', () => {
    expect(famePrior(player())).toBe(1);
  });

  it('is deterministic', () => {
    const f = player({
      honours: [{type: 'world-cup', count: 1}],
      tags: ['legends'],
    });
    expect(famePrior(f)).toBe(famePrior(f));
  });

  it('weighs honours by type and count', () => {
    // One World Cup = 5 honour points on top of the floor.
    expect(famePrior(player({honours: [{type: 'world-cup', count: 1}]}))).toBe(6);
    // Two Champions Leagues (via years) = 2 × 4 = 8.
    expect(
      famePrior(player({honours: [{type: 'champions-league', years: [2019, 2023]}]})),
    ).toBe(9);
    // An honour with neither count nor years still counts once.
    expect(famePrior(player({honours: [{type: 'ballon-dor'}]}))).toBe(7);
  });

  it('caps honour points at 24', () => {
    // 10 league titles (20) + 2 Champions Leagues (8) = 28 → capped at 24.
    const f = player({
      honours: [
        {type: 'league-title', count: 10},
        {type: 'champions-league', count: 2},
      ],
    });
    expect(famePrior(f)).toBe(25);
  });

  it('adds a point per 100 career appearances, capped at 6', () => {
    const spells = (apps: number) => [{clubId: 'real-madrid', appearances: apps}];
    expect(famePrior(player({clubs: spells(350)}))).toBe(1 + 3 + 2); // +2 top-5 league
    expect(famePrior(player({clubs: spells(900)}))).toBe(1 + 6 + 2);
  });

  it('rewards spells across distinct top-5 leagues, capped at 3 leagues', () => {
    const f = player({
      clubs: [
        {clubId: 'real-madrid'}, // la-liga
        {clubId: 'man-utd'}, // premier-league
      ],
    });
    expect(famePrior(f)).toBe(1 + 4);
  });

  it('boosts tagged players', () => {
    expect(famePrior(player({tags: ['legends']}))).toBe(9);
    expect(famePrior(player({tags: ['current-stars']}))).toBe(5);
  });
});

describe('normalizePriors', () => {
  const squad = [
    player({id: 'a', honours: [{type: 'ballon-dor', count: 5}]}),
    player({id: 'b', honours: [{type: 'world-cup', count: 1}]}),
    player({id: 'c'}),
    player({id: 'd'}),
  ];

  it('sums to PSEUDO_PER_PLAYER per player (within rounding)', () => {
    const entries = normalizePriors(squad);
    const total = entries.reduce((s, e) => s + e.w, 0);
    expect(total).toBeGreaterThan(PSEUDO_PER_PLAYER * squad.length - 0.1);
    expect(total).toBeLessThan(PSEUDO_PER_PLAYER * squad.length + 0.1);
  });

  it('gives more famous players heavier pseudo-counts, all positive', () => {
    const entries = normalizePriors(squad);
    const w = Object.fromEntries(entries.map(e => [e.id, e.w]));
    expect(w.a).toBeGreaterThan(w.b);
    expect(w.b).toBeGreaterThan(w.c);
    expect(w.c).toBe(w.d);
    for (const e of entries) {
      expect(e.w).toBeGreaterThan(0);
    }
  });
});
