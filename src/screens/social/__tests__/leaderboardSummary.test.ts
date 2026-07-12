import {leaderboardSummary} from '../leaderboardSummary';

describe('leaderboardSummary', () => {
  it('counts a scout win as guesses including the winning one', () => {
    // score = non-winning guesses, so a win in 4 guesses has score 3.
    expect(leaderboardSummary('scout', 'won', 3, 1)).toEqual({
      key: 'leaderboard.solvedGuesses',
      params: {count: 4},
    });
  });

  it('counts a journeyman win the same way', () => {
    expect(leaderboardSummary('journeyman', 'won', 0, 1)).toEqual({
      key: 'leaderboard.solvedGuesses',
      params: {count: 1},
    });
  });

  it('shows a give-up for the guess games, no count', () => {
    expect(leaderboardSummary('scout', 'revealed', 6, 0)).toEqual({
      key: 'leaderboard.gaveUp',
    });
    expect(leaderboardSummary('journeyman', 'revealed', 9, 0)).toEqual({
      key: 'leaderboard.gaveUp',
    });
  });

  it('reports found-out-of-ten with misses for Top Bins', () => {
    expect(leaderboardSummary('tenball', 'won', 2, 10)).toEqual({
      key: 'leaderboard.foundMisses',
      params: {found: 10, of: 10, count: 2},
    });
  });

  it('reports found-out-of-eleven with misses for Team Sheet', () => {
    expect(leaderboardSummary('teamsheet', 'revealed', 9, 8)).toEqual({
      key: 'leaderboard.foundMisses',
      params: {found: 8, of: 11, count: 9},
    });
  });
});
