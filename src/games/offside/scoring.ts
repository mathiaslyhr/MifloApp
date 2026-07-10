/**
 * Pure speed-scoring maths for Offside. No React, no store — the client
 * computes points at tap time from the shared server deadline, and the submit
 * RPC re-verifies correctness and clamps the range, so every device scores off
 * the same clock without trusting anyone's maths blindly.
 */
import {BASE_POINTS, MAX_POINTS, QUESTION_DURATION_MS} from './types';

/**
 * Points for one answer: 0 if wrong or unanswered, otherwise BASE_POINTS plus a
 * speed bonus scaled by how much time was left (1 = instant, 0 = buzzer).
 */
export function scoreAnswer(correct: boolean, fractionLeft: number): number {
  if (!correct) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, fractionLeft));
  return Math.round(BASE_POINTS + (MAX_POINTS - BASE_POINTS) * clamped);
}

/**
 * Fraction of the answer window still left, from the absolute server deadline
 * — clamped to [0, 1]. Drives both the countdown and the speed bonus, so every
 * device scores off the same shared deadline regardless of clock drift.
 */
export function fractionRemaining(deadlineTs: number, now: number): number {
  const remaining = deadlineTs - now;
  if (remaining <= 0) {
    return 0;
  }
  if (remaining >= QUESTION_DURATION_MS) {
    return 1;
  }
  return remaining / QUESTION_DURATION_MS;
}
