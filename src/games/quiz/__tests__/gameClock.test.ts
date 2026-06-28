/**
 * @format
 */
import {
  QUESTION_DURATION_MS,
  REVEAL_DURATION_MS,
  STANDINGS_DURATION_MS,
} from '../scoring';
import {
  fractionRemaining,
  nextTransition,
  phaseDurationMs,
} from '../gameClock';

describe('phaseDurationMs', () => {
  it('maps each phase to its scoring.ts duration', () => {
    expect(phaseDurationMs('question')).toBe(QUESTION_DURATION_MS);
    expect(phaseDurationMs('reveal')).toBe(REVEAL_DURATION_MS);
    expect(phaseDurationMs('standings')).toBe(STANDINGS_DURATION_MS);
  });
});

describe('nextTransition', () => {
  it('question → reveal on the same question', () => {
    expect(nextTransition('question', 0, 5)).toEqual({phase: 'reveal', index: 0});
  });

  it('reveal → standings on the same question', () => {
    expect(nextTransition('reveal', 2, 5)).toEqual({phase: 'standings', index: 2});
  });

  it('standings → next question when more remain', () => {
    expect(nextTransition('standings', 2, 5)).toEqual({phase: 'question', index: 3});
  });

  it('standings on the last question → finished', () => {
    expect(nextTransition('standings', 4, 5)).toEqual({finished: true});
  });
});

describe('fractionRemaining', () => {
  it('is 1 at the moment the question starts', () => {
    const now = 1_000_000;
    const deadline = now + QUESTION_DURATION_MS;
    expect(fractionRemaining(deadline, now)).toBe(1);
  });

  it('is ~0.5 halfway through', () => {
    const now = 1_000_000;
    const deadline = now + QUESTION_DURATION_MS;
    expect(fractionRemaining(deadline, now + QUESTION_DURATION_MS / 2)).toBeCloseTo(0.5);
  });

  it('clamps to 0 past the deadline', () => {
    const now = 1_000_000;
    const deadline = now + QUESTION_DURATION_MS;
    expect(fractionRemaining(deadline, deadline + 5_000)).toBe(0);
  });

  it('clamps to 1 if somehow called before the window', () => {
    const now = 1_000_000;
    const deadline = now + QUESTION_DURATION_MS + 5_000;
    expect(fractionRemaining(deadline, now)).toBe(1);
  });
});
