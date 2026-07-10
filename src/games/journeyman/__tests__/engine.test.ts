import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  giveUp,
  historyEntryFor,
  isFinished,
  recordResult,
  unlockedHints,
  upsertHistory,
  wrongGuessCount,
} from '../engine';

const start = () => createInitialState('2026-07-10', 'Secret, Sam');

describe('applyGuess', () => {
  it('appends a wrong guess and keeps playing', () => {
    const s = applyGuess(start(), 'Wrong, Willy');
    expect(s.guessedIds).toEqual(['Wrong, Willy']);
    expect(s.status).toBe('playing');
    expect(isFinished(s)).toBe(false);
  });

  it('wins when the secret is guessed', () => {
    const s = applyGuess(applyGuess(start(), 'Wrong, Willy'), 'Secret, Sam');
    expect(s.status).toBe('won');
    expect(isFinished(s)).toBe(true);
  });

  it('ignores duplicates and guesses after the game is over', () => {
    const one = applyGuess(start(), 'Wrong, Willy');
    expect(applyGuess(one, 'Wrong, Willy')).toBe(one);
    const won = applyGuess(one, 'Secret, Sam');
    expect(applyGuess(won, 'Another, Andy')).toBe(won);
  });
});

describe('giveUp', () => {
  it('reveals the answer and ends the day', () => {
    const s = giveUp(applyGuess(start(), 'Wrong, Willy'));
    expect(s.status).toBe('revealed');
    expect(isFinished(s)).toBe(true);
  });

  it('is a no-op once the game is finished', () => {
    const won = applyGuess(start(), 'Secret, Sam');
    expect(giveUp(won)).toBe(won);
  });
});

describe('hint unlocks', () => {
  it('unlocks one hint per wrong guess, in order, capped at three', () => {
    let s = start();
    expect(wrongGuessCount(s)).toBe(0);
    expect(unlockedHints(s)).toEqual([]);
    s = applyGuess(s, 'Wrong, One');
    expect(unlockedHints(s)).toEqual(['nationality']);
    s = applyGuess(s, 'Wrong, Two');
    expect(unlockedHints(s)).toEqual(['nationality', 'position']);
    s = applyGuess(s, 'Wrong, Three');
    expect(unlockedHints(s)).toEqual(['nationality', 'position', 'age']);
    s = applyGuess(s, 'Wrong, Four');
    s = applyGuess(s, 'Wrong, Five');
    expect(unlockedHints(s)).toEqual(['nationality', 'position', 'age']);
    expect(wrongGuessCount(s)).toBe(5);
  });

  it('does not count the winning guess as wrong', () => {
    const s = applyGuess(applyGuess(start(), 'Wrong, One'), 'Secret, Sam');
    expect(wrongGuessCount(s)).toBe(1);
    expect(unlockedHints(s)).toEqual(['nationality']);
  });
});

describe('recordResult', () => {
  it('starts and extends a day-after-day streak', () => {
    const day1 = recordResult(EMPTY_STREAK, '2026-07-09', 3, false);
    expect(day1).toEqual({current: 1, best: 1, lastCompletedDateKey: '2026-07-09'});
    const day2 = recordResult(day1, '2026-07-10', 5, false);
    expect(day2).toEqual({current: 2, best: 2, lastCompletedDateKey: '2026-07-10'});
  });

  it('restarts at 1 after a gap and keeps best', () => {
    const streak = {current: 4, best: 6, lastCompletedDateKey: '2026-07-01'};
    expect(recordResult(streak, '2026-07-10', 2, false)).toEqual({
      current: 1,
      best: 6,
      lastCompletedDateKey: '2026-07-10',
    });
  });

  it('breaks on an 11+ guess solve or a give-up, keeping best', () => {
    const streak = {current: 4, best: 6, lastCompletedDateKey: '2026-07-09'};
    expect(recordResult(streak, '2026-07-10', 11, false)).toEqual({
      ...streak,
      current: 0,
    });
    expect(recordResult(streak, '2026-07-10', 2, true)).toEqual({
      ...streak,
      current: 0,
    });
    // 10 exactly still counts.
    expect(recordResult(streak, '2026-07-10', 10, false).current).toBe(5);
  });
});

describe('history', () => {
  it('builds an entry from a finished state and upserts by day', () => {
    const won = applyGuess(applyGuess(start(), 'Wrong, One'), 'Secret, Sam');
    const entry = historyEntryFor(won);
    expect(entry).toEqual({dateKey: '2026-07-10', status: 'won', guessCount: 2});
    const revealed = historyEntryFor(giveUp(applyGuess(start(), 'Wrong, One')));
    expect(revealed.status).toBe('revealed');
    const log = upsertHistory(upsertHistory({}, entry), revealed);
    expect(log['2026-07-10']).toEqual(revealed);
  });
});
