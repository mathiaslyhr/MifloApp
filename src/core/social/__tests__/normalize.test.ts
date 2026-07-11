import {
  fromJourneymanEntry,
  fromScoutEntry,
  fromTeamsheetEntry,
  fromTenballEntry,
  liveStreak,
  ongoingResult,
} from '../normalize';

describe('normalize', () => {
  it('maps a scout win to guess count with no total', () => {
    expect(
      fromScoutEntry({dateKey: '2026-07-11', status: 'won', guessCount: 4}, 3),
    ).toEqual({
      dateKey: '2026-07-11',
      game: 'scout',
      status: 'won',
      score: 4,
      total: null,
      streak: 3,
    });
  });

  it("maps scout's legacy 'lost' entries to revealed", () => {
    const result = fromScoutEntry(
      {dateKey: '2026-07-11', status: 'lost', guessCount: 6},
      0,
    );
    expect(result.status).toBe('revealed');
  });

  it('maps journeyman to guess count with no total', () => {
    expect(
      fromJourneymanEntry({dateKey: '2026-07-11', status: 'revealed', guessCount: 9}, 0),
    ).toEqual({
      dateKey: '2026-07-11',
      game: 'journeyman',
      status: 'revealed',
      score: 9,
      total: null,
      streak: 0,
    });
  });

  it('maps tenball to its miss count', () => {
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
      total: null,
      streak: 7,
    });
  });

  it('maps teamsheet to its miss count', () => {
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
      total: null,
      streak: 0,
    });
  });

  it('builds an ongoing row with the running tries', () => {
    expect(ongoingResult('scout', '2026-07-11', 3, 5)).toEqual({
      dateKey: '2026-07-11',
      game: 'scout',
      status: 'ongoing',
      score: 3,
      total: null,
      streak: 5,
    });
  });

  it('clamps runaway counts so the backend never rejects a row', () => {
    expect(ongoingResult('tenball', '2026-07-11', 9999, 0).score).toBe(500);
  });

  it('only attaches a streak that is actually alive', () => {
    const streak = {current: 6, lastCompletedDateKey: '2026-07-10'};
    expect(liveStreak(streak, '2026-07-11')).toBe(6);
    // Last completed two days ago: the streak is already broken.
    expect(liveStreak({...streak, lastCompletedDateKey: '2026-07-09'}, '2026-07-11')).toBe(0);
    expect(liveStreak({current: 0, lastCompletedDateKey: null}, '2026-07-11')).toBe(0);
  });
});
