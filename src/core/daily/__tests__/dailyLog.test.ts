import {buildDailyLog, DAILY_GAMES, type DailyHistories} from '../dailyLog';
import type {StreakState} from '../../../games/scout/types';

const TODAY = '2026-07-11';

const EMPTY_HISTORIES: DailyHistories = {
  scout: {},
  tenball: {},
  journeyman: {},
  teamsheet: {},
};

const EMPTY_STREAK: StreakState = {current: 0, best: 0, lastCompletedDateKey: null};

const NO_STREAKS = {
  scout: EMPTY_STREAK,
  tenball: EMPTY_STREAK,
  journeyman: EMPTY_STREAK,
  teamsheet: EMPTY_STREAK,
};

const NO_STARTS = {
  scout: null,
  tenball: null,
  journeyman: null,
  teamsheet: null,
};

describe('buildDailyLog', () => {
  it('returns only today when no history exists', () => {
    const log = buildDailyLog(TODAY, EMPTY_HISTORIES, NO_STREAKS);
    expect(log.days).toHaveLength(1);
    expect(log.days[0].dateKey).toBe(TODAY);
    for (const game of DAILY_GAMES) {
      expect(log.days[0].cells[game]).toEqual({
        status: 'notPlayed',
        right: null,
        wrong: null,
      });
    }
  });

  it('extends back to the earliest entry across games, gap days as notPlayed', () => {
    const log = buildDailyLog(
      TODAY,
      {
        ...EMPTY_HISTORIES,
        scout: {
          '2026-07-10': {dateKey: '2026-07-10', status: 'won', guessCount: 3},
        },
        teamsheet: {
          '2026-07-07': {
            dateKey: '2026-07-07',
            lineupId: 'lineup-1',
            status: 'won',
            found: 11,
            misses: 2,
          },
        },
      },
      NO_STREAKS,
    );
    // 11th (today) back to the 7th inclusive.
    expect(log.days.map(d => d.dateKey)).toEqual([
      '2026-07-11',
      '2026-07-10',
      '2026-07-09',
      '2026-07-08',
      '2026-07-07',
    ]);
    // Scout win in 3: 1 right, the other 2 guesses wrong.
    expect(log.days[1].cells.scout).toEqual({status: 'won', right: 1, wrong: 2});
    // The 9th and 8th are gap days: nothing played anywhere.
    for (const game of DAILY_GAMES) {
      expect(log.days[2].cells[game].status).toBe('notPlayed');
      expect(log.days[3].cells[game].status).toBe('notPlayed');
    }
    expect(log.days[4].cells.teamsheet).toEqual({
      status: 'won',
      right: 11,
      wrong: 2,
      refId: 'lineup-1',
    });
  });

  it('caps the log at 30 days even with older entries', () => {
    const log = buildDailyLog(
      TODAY,
      {
        ...EMPTY_HISTORIES,
        journeyman: {
          '2026-01-01': {dateKey: '2026-01-01', status: 'won', guessCount: 1},
        },
      },
      NO_STREAKS,
    );
    expect(log.days).toHaveLength(30);
    expect(log.days[0].dateKey).toBe(TODAY);
    expect(log.days[29].dateKey).toBe('2026-06-12');
  });

  it("maps Scout's legacy 'lost' to revealed", () => {
    const log = buildDailyLog(
      TODAY,
      {
        ...EMPTY_HISTORIES,
        scout: {[TODAY]: {dateKey: TODAY, status: 'lost', guessCount: 6}},
        journeyman: {[TODAY]: {dateKey: TODAY, status: 'revealed', guessCount: 9}},
      },
      NO_STREAKS,
    );
    // Failed: 0 right, every guess wrong.
    expect(log.days[0].cells.scout).toEqual({status: 'revealed', right: 0, wrong: 6});
    expect(log.days[0].cells.journeyman).toEqual({
      status: 'revealed',
      right: 0,
      wrong: 9,
    });
  });

  it('maps right/wrong per game: found/misses, or 1-on-a-win/guesses', () => {
    const log = buildDailyLog(
      TODAY,
      {
        scout: {[TODAY]: {dateKey: TODAY, status: 'won', guessCount: 4}},
        journeyman: {[TODAY]: {dateKey: TODAY, status: 'revealed', guessCount: 9}},
        tenball: {
          [TODAY]: {dateKey: TODAY, listId: 'list-1', status: 'won', found: 10, misses: 5},
        },
        teamsheet: {
          [TODAY]: {
            dateKey: TODAY,
            lineupId: 'lineup-1',
            status: 'revealed',
            found: 8,
            misses: 12,
          },
        },
      },
      NO_STREAKS,
    );
    expect(log.days[0].cells).toEqual({
      scout: {status: 'won', right: 1, wrong: 3},
      journeyman: {status: 'revealed', right: 0, wrong: 9},
      tenball: {status: 'won', right: 10, wrong: 5, refId: 'list-1'},
      teamsheet: {status: 'revealed', right: 8, wrong: 12, refId: 'lineup-1'},
    });
  });

  it('marks started-but-unfinished games ongoing with their tries, today only', () => {
    const log = buildDailyLog(
      TODAY,
      {
        ...EMPTY_HISTORIES,
        // Yesterday finished, so history exists; today only progress exists.
        tenball: {
          '2026-07-10': {
            dateKey: '2026-07-10',
            listId: 'list-1',
            status: 'won',
            found: 10,
            misses: 3,
          },
        },
      },
      NO_STREAKS,
      {...NO_STARTS, scout: {right: 0, wrong: 2}, tenball: {right: 3, wrong: 5}},
    );
    expect(log.days[0].cells.scout).toEqual({status: 'ongoing', right: 0, wrong: 2});
    expect(log.days[0].cells.tenball).toEqual({status: 'ongoing', right: 3, wrong: 5});
    expect(log.days[0].cells.journeyman.status).toBe('notPlayed');
    // Yesterday never reads the started tries — finished from history only.
    expect(log.days[1].cells.tenball).toEqual({
      status: 'won',
      right: 10,
      wrong: 3,
      refId: 'list-1',
    });
    expect(log.days[1].cells.scout.status).toBe('notPlayed');
  });

  it('prefers the recorded result over ongoing when today is already finished', () => {
    const log = buildDailyLog(
      TODAY,
      {
        ...EMPTY_HISTORIES,
        scout: {[TODAY]: {dateKey: TODAY, status: 'won', guessCount: 2}},
      },
      NO_STREAKS,
      {...NO_STARTS, scout: {right: 0, wrong: 4}},
    );
    expect(log.days[0].cells.scout).toEqual({status: 'won', right: 1, wrong: 1});
  });

  it('passes each game its own streak', () => {
    const log = buildDailyLog(TODAY, EMPTY_HISTORIES, {
      ...NO_STREAKS,
      tenball: {current: 4, best: 9, lastCompletedDateKey: '2026-07-10'},
    });
    expect(log.streaks.tenball).toEqual({current: 4, best: 9});
    expect(log.streaks.scout).toEqual({current: 0, best: 0});
  });
});
