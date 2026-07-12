import {
  fromJourneymanEntry,
  fromScoutEntry,
  fromTeamsheetEntry,
  fromTenballEntry,
  liveStreak,
  ongoingResult,
} from '../normalize';

describe('normalize', () => {
  it('maps a scout win to 1 right + the non-winning guesses wrong', () => {
    expect(
      fromScoutEntry({dateKey: '2026-07-11', status: 'won', guessCount: 4}, 3),
    ).toEqual({
      dateKey: '2026-07-11',
      game: 'scout',
      status: 'won',
      score: 3,
      total: 1,
      streak: 3,
    });
  });

  it('maps a failed scout day to 0 right + all guesses wrong', () => {
    expect(
      fromScoutEntry({dateKey: '2026-07-11', status: 'lost', guessCount: 5}, 0),
    ).toEqual({
      dateKey: '2026-07-11',
      game: 'scout',
      status: 'revealed',
      score: 5,
      total: 0,
      streak: 0,
    });
  });

  it("maps scout's legacy 'lost' entries to revealed", () => {
    const result = fromScoutEntry(
      {dateKey: '2026-07-11', status: 'lost', guessCount: 6},
      0,
    );
    expect(result.status).toBe('revealed');
  });

  it('maps a failed journeyman day to 0 right + all guesses wrong', () => {
    expect(
      fromJourneymanEntry({dateKey: '2026-07-11', status: 'revealed', guessCount: 9}, 0),
    ).toEqual({
      dateKey: '2026-07-11',
      game: 'journeyman',
      status: 'revealed',
      score: 9,
      total: 0,
      streak: 0,
    });
  });

  it('maps tenball to found (right) + misses (wrong)', () => {
    expect(
      fromTenballEntry(
        {dateKey: '2026-07-11', listId: 'list-1', status: 'won', found: 10, misses: 2},
        7,
      ),
    ).toEqual({
      dateKey: '2026-07-11',
      game: 'tenball',
      status: 'won',
      score: 2,
      total: 10,
      streak: 7,
    });
  });

  it('maps teamsheet to found (right) + misses (wrong)', () => {
    expect(
      fromTeamsheetEntry(
        {
          dateKey: '2026-07-11',
          lineupId: 'lineup-1',
          status: 'revealed',
          found: 8,
          misses: 9,
        },
        0,
      ),
    ).toEqual({
      dateKey: '2026-07-11',
      game: 'teamsheet',
      status: 'revealed',
      score: 9,
      total: 8,
      streak: 0,
    });
  });

  it('builds an ongoing row with the running right/wrong counts', () => {
    expect(ongoingResult('tenball', '2026-07-11', 2, 3, 5)).toEqual({
      dateKey: '2026-07-11',
      game: 'tenball',
      status: 'ongoing',
      score: 3,
      total: 2,
      streak: 5,
    });
  });

  it('clamps a runaway wrong count so the backend never rejects a row', () => {
    expect(ongoingResult('tenball', '2026-07-11', 5, 9999, 0).score).toBe(500);
  });

  it('only attaches a streak that is actually alive', () => {
    const streak = {current: 6, lastCompletedDateKey: '2026-07-10'};
    expect(liveStreak(streak, '2026-07-11')).toBe(6);
    // Last completed two days ago: the streak is already broken.
    expect(liveStreak({...streak, lastCompletedDateKey: '2026-07-09'}, '2026-07-11')).toBe(0);
    expect(liveStreak({current: 0, lastCompletedDateKey: null}, '2026-07-11')).toBe(0);
  });
});
