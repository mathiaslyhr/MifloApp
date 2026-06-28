/**
 * @format
 */
import {buildQuestions, usedFootballers} from '../questions';
import {all, CLUBS, getById, getClub} from '../../../data/football';
import type {Footballer, HonourType} from '../../../data/football';

const playerByName = new Map<string, Footballer>(all().map(f => [f.name, f]));
const clubIdByName = new Map<string, string>(CLUBS.map(c => [c.name, c.id]));

function playedFor(f: Footballer, clubId: string): boolean {
  return f.clubs.some(s => s.clubId === clubId);
}
function hasHonour(f: Footballer, type: HonourType): boolean {
  return f.honours.some(h => h.type === type);
}

/** Deterministic RNG (mulberry32) so generated questions are stable in tests. */
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
    const questions = buildQuestions(['premier-league'], 5, {rng: seededRng(1)});
    expect(questions).toHaveLength(5);
  });

  it('produces valid, well-formed questions', () => {
    const questions = buildQuestions(['all'], 10, {rng: seededRng(2)});
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4); // unique options
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.footballerId).toBeDefined();
    }
  });

  it('caps output at available candidates without throwing', () => {
    const questions = buildQuestions(['premier-league'], 1000, {rng: seededRng(3)});
    expect(questions.length).toBeGreaterThan(0);
  });

  it('defaults to all topics when none given', () => {
    expect(buildQuestions([], 3, {rng: seededRng(4)})).toHaveLength(3);
  });

  it('club questions mark a real club of that player as correct', () => {
    // Generate a large batch so every footballer's club question is covered.
    const questions = buildQuestions(['all'], 500, {rng: seededRng(9)});
    const clubQuestions = questions.filter(q => q.topic === 'Clubs');
    expect(clubQuestions.length).toBeGreaterThan(0);

    for (const q of clubQuestions) {
      const footballer = getById(q.footballerId!)!;
      const playedFor = new Set(
        footballer.clubs.map(s => getClub(s.clubId)!.name),
      );
      const correct = q.options[q.correctIndex];
      expect(playedFor.has(correct)).toBe(true); // would catch Neymar/Al Nassr
      // The three distractors must be clubs he never played for.
      q.options
        .filter((_, i) => i !== q.correctIndex)
        .forEach(opt => expect(playedFor.has(opt)).toBe(false));
    }
  });

  it('"both clubs" questions have exactly one player who played both', () => {
    const qs = buildQuestions(['all'], 500, {rng: seededRng(11)});
    const both = qs.filter(q => q.prompt.startsWith('Which player played for both '));
    expect(both.length).toBeGreaterThan(0);

    for (const q of both) {
      const m = q.prompt.match(/^Which player played for both (.+) and (.+)\?$/);
      const aId = clubIdByName.get(m![1])!;
      const bId = clubIdByName.get(m![2])!;
      const correct = playerByName.get(q.options[q.correctIndex])!;
      expect(playedFor(correct, aId) && playedFor(correct, bId)).toBe(true);
      q.options
        .filter((_, i) => i !== q.correctIndex)
        .forEach(opt => {
          const p = playerByName.get(opt)!;
          expect(playedFor(p, aId) && playedFor(p, bId)).toBe(false);
        });
    }
  });

  it('"won the trophy" questions name a real winner, distractors never won it', () => {
    const qs = buildQuestions(['all'], 500, {rng: seededRng(12)});
    const trophy = qs.filter(
      q =>
        q.prompt.startsWith('Which of these players has won the ') &&
        !q.prompt.includes(' most '),
    );
    expect(trophy.length).toBeGreaterThan(0);

    for (const q of trophy) {
      const label = q.prompt.match(/has won the (.+)\?$/)![1];
      const type: HonourType =
        label === 'World Cup' ? 'world-cup' : 'champions-league';
      const correct = playerByName.get(q.options[q.correctIndex])!;
      expect(hasHonour(correct, type)).toBe(true);
      q.options
        .filter((_, i) => i !== q.correctIndex)
        .forEach(opt => expect(hasHonour(playerByName.get(opt)!, type)).toBe(false));
    }
  });

  it('a follow-up round excludes the previous round players (fresh questions)', () => {
    const round1 = buildQuestions(['all'], 5, {rng: seededRng(5)});
    const used = usedFootballers(round1);
    const round2 = buildQuestions(['all'], 5, {rng: seededRng(6), exclude: used});

    for (const q of round2) {
      expect(used.has(q.footballerId!)).toBe(false);
    }
  });
});
