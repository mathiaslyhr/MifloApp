/**
 * Pure host-clock logic for the synced (M4) round. The host walks the phase
 * machine and writes each transition (phase + question index + absolute
 * deadline) to the room; every device renders from that. Kept React-free and
 * transport-free so it's easy to unit-test and reuse.
 */
import type {Phase} from './store';
import {
  QUESTION_DURATION_MS,
  REVEAL_DURATION_MS,
  STANDINGS_DURATION_MS,
} from './scoring';

/** How long a given phase lasts before the host advances. */
export function phaseDurationMs(phase: Phase): number {
  switch (phase) {
    case 'question':
      return QUESTION_DURATION_MS;
    case 'reveal':
      return REVEAL_DURATION_MS;
    case 'standings':
      return STANDINGS_DURATION_MS;
  }
}

export type Transition =
  | {phase: Phase; index: number; finished?: false}
  | {finished: true};

/**
 * The next step in the round: question → reveal → standings → (next question or
 * finished). `total` is the number of questions in the deck.
 */
export function nextTransition(phase: Phase, index: number, total: number): Transition {
  if (phase === 'question') {
    return {phase: 'reveal', index};
  }
  if (phase === 'reveal') {
    return {phase: 'standings', index};
  }
  // standings → advance to the next question, or finish the game
  if (index + 1 < total) {
    return {phase: 'question', index: index + 1};
  }
  return {finished: true};
}

/**
 * Fraction of the answer window still left, from an absolute deadline timestamp
 * — clamped to [0, 1]. Drives both the countdown ring and the speed bonus, so
 * every device scores off the same shared deadline regardless of clock drift.
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
