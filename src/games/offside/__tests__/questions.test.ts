/**
 * @format
 */
import {buildRounds} from '../questions';
import {explanationFor, topicKeyFor} from '../engine';
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
  it('returns the requested number of rounds, up to the 20-round maximum', () => {
    expect(buildRounds(8, {rng: seededRng(1)})).toHaveLength(8);
    expect(buildRounds(20, {rng: seededRng(1)})).toHaveLength(20);
  });

  it('builds well-formed rounds: 4 distinct players, valid outlier index', () => {
    const rounds = buildRounds(12, {rng: seededRng(2)});
    for (const r of rounds) {
      expect(r.cards).toHaveLength(4);
      const ids = r.cards.map(c => c.footballerId);
      expect(new Set(ids).size).toBe(4);
      expect(r.outlierIndex).toBeGreaterThanOrEqual(0);
      expect(r.outlierIndex).toBeLessThan(4);
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

  it('only emits criteria the reveal can explain (no generic fallback)', () => {
    // Across many seeds we should hit a wide spread of criterion kinds, and
    // every one must resolve to a real reveal line and category chip rather
    // than degrading to the generic/mixed fallback.
    for (let seed = 1; seed <= 12; seed++) {
      const rounds = buildRounds(20, {rng: seededRng(seed)});
      for (const r of rounds) {
        expect(explanationFor(r).key).not.toBe('offside.explanation.generic');
        expect(topicKeyFor(r.criterion)).not.toBe('offside.topic.mixed');
      }
    }
  });

  it('the legends cut pairs three legends with a current-star outlier', () => {
    // Legends is one spec among hundreds, so exhaust the pool (which walks every
    // spec round-robin) to reliably surface it.
    const legendsRounds = buildRounds(1000, {rng: seededRng(7)}).filter(
      r => r.criterion.kind === 'tag' && r.criterion.tag === 'legends',
    );
    expect(legendsRounds.length).toBeGreaterThan(0);
    for (const r of legendsRounds) {
      const outlier = getById(r.cards[r.outlierIndex].footballerId)!;
      expect(outlier.tags ?? []).toContain('current-stars');
      expect(outlier.tags ?? []).not.toContain('legends');
    }
  });
});
