/**
 * Structural integrity of the expanded football dataset. These guard the SHAPE
 * of the data (broken references, malformed honours, too-thin pools) — they do
 * NOT and cannot verify factual accuracy (that a player really won X). Factual
 * curation is a manual discipline; see footballers.ts.
 */
import {
  buildQuestions,
  countMatchingQuestions,
  usedFootballers,
} from '../../../games/quiz/questions';
import {getClub} from '../clubs';
import {all, byCategory} from '../repository';
import type {Rng} from '../repository';

/** Deterministic RNG (mulberry32) so freshness/sampling is reproducible. */
function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('referential integrity', () => {
  it('every footballer id is unique', () => {
    const ids = all().map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every referenced clubId exists in CLUBS', () => {
    for (const f of all()) {
      for (const spell of f.clubs) {
        expect(getClub(spell.clubId)).toBeDefined();
      }
    }
  });

  it('no club spell ends before it starts', () => {
    for (const f of all()) {
      for (const spell of f.clubs) {
        if (spell.from !== undefined && spell.to !== undefined) {
          expect(spell.to).toBeGreaterThanOrEqual(spell.from);
        }
      }
    }
  });
});

describe('honour integrity', () => {
  it('every Ballon d\'Or honour lists years matching its count', () => {
    for (const f of all()) {
      for (const h of f.honours) {
        if (h.type === 'ballon-dor') {
          expect(h.years).toBeDefined();
          expect(h.years!.length).toBe(h.count);
        }
      }
    }
  });

  it('any honour years never exceed its count', () => {
    for (const f of all()) {
      for (const h of f.honours) {
        if (h.years && h.count !== undefined) {
          expect(h.years.length).toBeLessThanOrEqual(h.count);
        }
      }
    }
  });

  it('has at least 4 distinct Ballon d\'Or winners with years (ballonDorYear needs them)', () => {
    const winners = all().filter(f =>
      f.honours.some(h => h.type === 'ballon-dor' && (h.years?.length ?? 0) > 0),
    );
    expect(winners.length).toBeGreaterThanOrEqual(4);
  });
});

describe('category pools are deep enough', () => {
  // [topic, min footballers, min generatable questions]
  const cases: [string, number, number][] = [
    ['premier-league', 15, 40],
    ['la-liga', 15, 40],
    ['serie-a', 12, 35],
    ['bundesliga', 8, 20],
    ['ligue-1', 8, 20],
    ['champions-league', 20, 40],
    ['world-cup', 15, 40],
    ['legends', 25, 60],
  ];

  it.each(cases)('%s has a deep pool', (topic, minPlayers, minQuestions) => {
    expect(byCategory(topic).length).toBeGreaterThanOrEqual(minPlayers);
    expect(countMatchingQuestions([topic])).toBeGreaterThanOrEqual(minQuestions);
  });

  it('the "all" pool dwarfs a single game', () => {
    expect(countMatchingQuestions(['all'])).toBeGreaterThanOrEqual(120);
  });
});

describe('three back-to-back rounds stay full and fresh', () => {
  it('builds 20 → exclude → 20 → exclude → 20, all full', () => {
    const rng = seededRng(42);
    const exclude = new Set<string>();
    for (let round = 0; round < 3; round++) {
      const qs = buildQuestions(['all'], 20, {rng, exclude});
      expect(qs).toHaveLength(20);
      for (const id of usedFootballers(qs)) {
        exclude.add(id);
      }
    }
  });
});
