/**
 * @format
 */
import {buildQuestions} from '../questions';
import {FAMOUS_LINEUPS} from '../../../data/football';

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

describe('buildQuestions', () => {
  it('returns the requested number of questions', () => {
    expect(buildQuestions(8, {rng: seededRng(1)})).toHaveLength(8);
  });

  it('builds well-formed questions: 11 players, valid hidden index', () => {
    const qs = buildQuestions(12, {rng: seededRng(2)});
    for (const q of qs) {
      expect(q.players).toHaveLength(11);
      expect(q.hiddenIndex).toBeGreaterThanOrEqual(0);
      expect(q.hiddenIndex).toBeLessThan(11);
      expect(q.players[q.hiddenIndex].name.length).toBeGreaterThan(0);
      expect(q.formation.length).toBeGreaterThan(0);
    }
  });

  it('uses distinct lineups before repeating any', () => {
    const qs = buildQuestions(FAMOUS_LINEUPS.length, {rng: seededRng(3)});
    const ids = qs.map(q => q.lineupId);
    expect(new Set(ids).size).toBe(FAMOUS_LINEUPS.length);
  });

  it('never hides the same slot of the same lineup twice', () => {
    const qs = buildQuestions(FAMOUS_LINEUPS.length * 2, {rng: seededRng(4)});
    const seen = new Set<string>();
    for (const q of qs) {
      const key = `${q.lineupId}#${q.hiddenIndex}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('caps output at the available pool without throwing', () => {
    const qs = buildQuestions(10_000, {rng: seededRng(5)});
    expect(qs.length).toBeGreaterThan(0);
  });
});
