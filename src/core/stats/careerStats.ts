/**
 * Pure career-stats aggregation. No React, no backend — kept separate (like
 * src/games/quiz/scoring.ts) so it's trivially unit-testable and importing it
 * doesn't drag in the Supabase client.
 */
import type {CareerStats, GameResult} from './types';

/** Aggregate a list of results into career totals. */
export function computeCareerStats(results: readonly GameResult[]): CareerStats {
  const gamesPlayed = results.length;
  const wins = results.filter(r => r.isWinner).length;
  const totalPoints = results.reduce((sum, r) => sum + r.score, 0);
  const bestScore = results.reduce((max, r) => Math.max(max, r.score), 0);
  return {
    gamesPlayed,
    wins,
    winRate: gamesPlayed === 0 ? 0 : wins / gamesPlayed,
    totalPoints,
    bestScore,
  };
}
