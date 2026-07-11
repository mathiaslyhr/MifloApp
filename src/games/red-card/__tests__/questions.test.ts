import {buildQuestionIds, QUESTION_POOL} from '../questions';
import {MAX_ROUNDS} from '../types';

/** Deterministic rng for shuffle-based helpers. */
function seededRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('buildQuestionIds', () => {
  it('deals distinct ids, preferring unasked ones first', () => {
    const used = QUESTION_POOL.slice(0, 3);
    const ids = buildQuestionIds(4, seededRng(), used);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  // The host can pick up to MAX_ROUNDS questions per hand; the pool (plus the
  // history refill) must always cover it, even when most ids were asked.
  it('always fills a maximum-length hand', () => {
    for (const used of [[], QUESTION_POOL.slice(0, QUESTION_POOL.length - 2)]) {
      const ids = buildQuestionIds(MAX_ROUNDS, seededRng(7), used);
      expect(ids).toHaveLength(MAX_ROUNDS);
      expect(new Set(ids).size).toBe(MAX_ROUNDS);
    }
    expect(QUESTION_POOL.length).toBeGreaterThanOrEqual(MAX_ROUNDS);
  });
});
