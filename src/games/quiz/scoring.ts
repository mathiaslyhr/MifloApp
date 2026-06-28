/**
 * Pure scoring + standings logic for the quiz loop. No React, no store — kept
 * separate so it's easy to unit-test and so M4's synced game loop can reuse the
 * exact same maths server-side.
 */

/** How long a player has to answer one question. */
export const QUESTION_DURATION_MS = 20_000;
/** How long the correct answer + points stay on screen before standings. */
export const REVEAL_DURATION_MS = 4_000;
/** How long the standings stay up before the next question. */
export const STANDINGS_DURATION_MS = 5_000;
/** Floor for a correct answer; speed bonus is added on top up to MAX_POINTS. */
export const BASE_POINTS = 500;
export const MAX_POINTS = 1000;

/**
 * Points for one answer: 0 if wrong or unanswered, otherwise BASE_POINTS plus a
 * speed bonus scaled by how much time was left (1 = instant, 0 = buzzer).
 */
export function scoreAnswer(correct: boolean, fractionRemaining: number): number {
  if (!correct) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, fractionRemaining));
  return Math.round(BASE_POINTS + (MAX_POINTS - BASE_POINTS) * clamped);
}

export type Contestant = {
  id: string;
  name: string;
  score: number;
  isYou?: boolean;
};

export type Movement = 'up' | 'down' | 'none';

export type Standing = {
  rank: number;
  contestant: Contestant;
  movement: Movement;
};

/**
 * Rank contestants by score (ties broken by name for stability). If a previous
 * rank map is given, each standing reports whether it moved up/down since.
 */
export function rankContestants(
  contestants: readonly Contestant[],
  prevRankById?: Record<string, number>,
): Standing[] {
  const sorted = [...contestants].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
  return sorted.map((contestant, i) => {
    const rank = i + 1;
    const prev = prevRankById?.[contestant.id];
    let movement: Movement = 'none';
    if (prev !== undefined && prev !== rank) {
      movement = rank < prev ? 'up' : 'down';
    }
    return {rank, contestant, movement};
  });
}

/** Snapshot of current ranks, to feed back into rankContestants next round. */
export function ranksById(standings: readonly Standing[]): Record<string, number> {
  return Object.fromEntries(standings.map(s => [s.contestant.id, s.rank]));
}
