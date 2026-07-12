/**
 * headToHead: the pure pairwise tally behind the friend head-to-head screen.
 * "Who won" is decided by comparing the two friends' scores in each shared
 * game — independent of who topped a 3+ player room.
 */
import {
  computeHeadToHead,
  outcomeOf,
  type HeadToHeadMatch,
} from '../headToHead';

function match(
  gameType: string,
  mineScore: number,
  theirsScore: number,
  overrides: Partial<HeadToHeadMatch> = {},
): HeadToHeadMatch {
  return {
    matchId: `${gameType}-${mineScore}-${theirsScore}`,
    gameType,
    playedAt: '2026-07-12T10:00:00Z',
    totalPlayers: 2,
    mine: {score: mineScore, rank: 0, isWinner: false},
    theirs: {score: theirsScore, rank: 0, isWinner: false},
    ...overrides,
  };
}

describe('outcomeOf', () => {
  it('higher score wins, lower loses, equal draws', () => {
    expect(outcomeOf(match('offside', 5, 3))).toBe('win');
    expect(outcomeOf(match('offside', 2, 6))).toBe('loss');
    expect(outcomeOf(match('offside', 4, 4))).toBe('draw');
  });

  it('is pairwise: I can win a matchup without winning the room', () => {
    // A 4-player game a third player topped; still, I beat this friend.
    const m = match('cult-hero', 7, 5, {totalPlayers: 4});
    expect(outcomeOf(m)).toBe('win');
  });
});

describe('computeHeadToHead', () => {
  it('is all zeros for no games', () => {
    expect(computeHeadToHead([])).toEqual({
      myWins: 0,
      theirWins: 0,
      draws: 0,
      total: 0,
      perGame: {},
    });
  });

  it('tallies overall wins, losses and draws', () => {
    const summary = computeHeadToHead([
      match('offside', 5, 3), // win
      match('offside', 1, 4), // loss
      match('hattrick', 1, 1), // draw
      match('red-card', 3, 0), // win
    ]);
    expect(summary.myWins).toBe(2);
    expect(summary.theirWins).toBe(1);
    expect(summary.draws).toBe(1);
    expect(summary.total).toBe(4);
  });

  it('buckets the tally by game type', () => {
    const summary = computeHeadToHead([
      match('offside', 5, 3), // offside win
      match('offside', 0, 2), // offside loss
      match('hattrick', 1, 0), // hattrick win
      match('hattrick', 0, 0), // hattrick draw
    ]);
    expect(summary.perGame.offside).toEqual({myWins: 1, theirWins: 1, draws: 0});
    expect(summary.perGame.hattrick).toEqual({myWins: 1, theirWins: 0, draws: 1});
    // The overall tally is the sum of the buckets.
    expect(summary.myWins).toBe(2);
    expect(summary.theirWins).toBe(1);
    expect(summary.draws).toBe(1);
  });
});
