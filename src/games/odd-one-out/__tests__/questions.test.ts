/**
 * @format
 */
import {buildRounds} from '../questions';
import {getById, matches} from '../../../data/football';

/** Deterministic RNG (mulberry32) so generated rounds are stable in tests. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('buildRounds', () => {
  it('returns the requested number of rounds', () => {
    expect(buildRounds(8, {rng: seededRng(1)})).toHaveLength(8);
  });

  it('builds well-formed rounds: 4 distinct players, valid outlier index', () => {
    const rounds = buildRounds(12, {rng: seededRng(2)});
    for (const r of rounds) {
      expect(r.cards).toHaveLength(4);
      const ids = r.cards.map(c => c.footballerId);
      expect(new Set(ids).size).toBe(4);
      expect(r.outlierIndex).toBeGreaterThanOrEqual(0);
      expect(r.outlierIndex).toBeLessThan(4);
      expect(r.explanation.length).toBeGreaterThan(0);
    }
  });

  it('the three non-outlier players match the criterion; the outlier does not', () => {
    const rounds = buildRounds(15, {rng: seededRng(3)});
    expect(rounds.length).toBeGreaterThan(0);
    for (const r of rounds) {
      r.cards.forEach((card, i) => {
        const player = getById(card.footballerId)!;
        expect(player).toBeDefined();
        const isMatch = matches(player, r.criterion);
        if (i === r.outlierIndex) {
          expect(isMatch).toBe(false); // exactly the outlier fails
        } else {
          expect(isMatch).toBe(true); // the other three share the attribute
        }
      });
    }
  });

  it('never reuses a player across rounds', () => {
    const rounds = buildRounds(15, {rng: seededRng(4)});
    const seen = new Set<string>();
    for (const r of rounds) {
      for (const card of r.cards) {
        expect(seen.has(card.footballerId)).toBe(false);
        seen.add(card.footballerId);
      }
    }
  });

  it('caps output at the available pool without throwing', () => {
    const rounds = buildRounds(1000, {rng: seededRng(5)});
    expect(rounds.length).toBeGreaterThan(0);
  });
});
