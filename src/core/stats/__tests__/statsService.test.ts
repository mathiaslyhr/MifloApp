/**
 * @format
 */
import {computeCareerStats} from '../careerStats';
import type {GameResult} from '../types';

function result(over: Partial<GameResult>): GameResult {
  return {
    id: Math.random().toString(),
    roomCode: 'ABCD',
    gameType: 'quiz',
    name: 'You',
    score: 0,
    rank: 1,
    isWinner: false,
    totalPlayers: 4,
    topicIds: ['all'],
    questionCount: 10,
    playedAt: '2026-06-29T12:00:00.000Z',
    ...over,
  };
}

describe('computeCareerStats', () => {
  it('returns zeroes for no games', () => {
    expect(computeCareerStats([])).toEqual({
      gamesPlayed: 0,
      wins: 0,
      winRate: 0,
      totalPoints: 0,
      bestScore: 0,
    });
  });

  it('aggregates games, wins, points and best score', () => {
    const stats = computeCareerStats([
      result({score: 1200, rank: 1, isWinner: true}),
      result({score: 800, rank: 3, isWinner: false}),
      result({score: 2000, rank: 1, isWinner: true}),
    ]);
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.totalPoints).toBe(4000);
    expect(stats.bestScore).toBe(2000);
  });

  it('reports win rate as a fraction in [0, 1]', () => {
    const stats = computeCareerStats([
      result({isWinner: true}),
      result({isWinner: false}),
      result({isWinner: false}),
      result({isWinner: false}),
    ]);
    expect(stats.winRate).toBeCloseTo(0.25);
  });
});
