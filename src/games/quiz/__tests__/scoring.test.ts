/**
 * @format
 */
import {
  BASE_POINTS,
  MAX_POINTS,
  rankContestants,
  ranksById,
  scoreAnswer,
  type Contestant,
} from '../scoring';

describe('scoreAnswer', () => {
  it('gives nothing for a wrong answer', () => {
    expect(scoreAnswer(false, 1)).toBe(0);
  });

  it('gives the max for an instant correct answer', () => {
    expect(scoreAnswer(true, 1)).toBe(MAX_POINTS);
  });

  it('gives the floor for a last-moment correct answer', () => {
    expect(scoreAnswer(true, 0)).toBe(BASE_POINTS);
  });

  it('scales the speed bonus linearly and clamps out-of-range input', () => {
    expect(scoreAnswer(true, 0.5)).toBe(750);
    expect(scoreAnswer(true, 5)).toBe(MAX_POINTS);
    expect(scoreAnswer(true, -1)).toBe(BASE_POINTS);
  });
});

describe('rankContestants', () => {
  const players: Contestant[] = [
    {id: 'you', name: 'You', score: 1200, isYou: true},
    {id: 'a', name: 'Magnus', score: 1500},
    {id: 'b', name: 'Oliver', score: 900},
  ];

  it('ranks by score descending', () => {
    const order = rankContestants(players).map(s => s.contestant.id);
    expect(order).toEqual(['a', 'you', 'b']);
  });

  it('reports movement against previous ranks', () => {
    const prev = ranksById(rankContestants(players)); // a=1, you=2, b=3
    // You overtake Magnus.
    const updated = players.map(p =>
      p.id === 'you' ? {...p, score: 1600} : p,
    );
    const standings = rankContestants(updated, prev);
    const byId = Object.fromEntries(standings.map(s => [s.contestant.id, s]));
    expect(byId.you.rank).toBe(1);
    expect(byId.you.movement).toBe('up');
    expect(byId.a.movement).toBe('down');
    expect(byId.b.movement).toBe('none');
  });
});
