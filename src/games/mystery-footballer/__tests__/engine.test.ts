import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  historyEntryFor,
  isFinished,
  MAX_GUESSES,
  recordResult,
  remainingGuesses,
  upsertHistory,
} from '../engine';
import type {HistoryLog} from '../types';

// Real dataset ids — applyGuess resolves them through compareFootballers.
const SECRET = 'Abraham, Tammy';
const OTHER = 'Aaronson, Brenden';
const OTHER2 = 'Adams, Che';

describe('applyGuess', () => {
  it('appends a compared row and keeps playing on a wrong guess', () => {
    const s = applyGuess(createInitialState('2026-07-07', SECRET), OTHER);
    expect(s.guesses).toHaveLength(1);
    expect(s.guesses[0].footballerId).toBe(OTHER);
    expect(s.guesses[0].cells).toHaveLength(6);
    expect(s.status).toBe('playing');
  });

  it('flips to won when the secret is guessed', () => {
    const s = applyGuess(createInitialState('2026-07-07', SECRET), SECRET);
    expect(s.status).toBe('won');
    expect(s.guesses[0].cells.every(c => c.status === 'hit')).toBe(true);
  });

  it('flips to lost when the last guess is spent without the secret', () => {
    let s = createInitialState('2026-07-07', SECRET, 2);
    s = applyGuess(s, OTHER);
    expect(s.status).toBe('playing');
    s = applyGuess(s, OTHER2);
    expect(s.status).toBe('lost');
    expect(remainingGuesses(s)).toBe(0);
  });

  it('is a no-op when finished or the id was already guessed', () => {
    const won = applyGuess(createInitialState('2026-07-07', SECRET), SECRET);
    expect(applyGuess(won, OTHER)).toBe(won);
    let s = applyGuess(createInitialState('2026-07-07', SECRET), OTHER);
    expect(applyGuess(s, OTHER).guesses).toHaveLength(1);
  });

  it('defaults to six guesses', () => {
    expect(createInitialState('2026-07-07', SECRET).maxGuesses).toBe(MAX_GUESSES);
    expect(isFinished(createInitialState('2026-07-07', SECRET))).toBe(false);
  });
});

describe('recordResult', () => {
  it('increments on a consecutive-day win', () => {
    const day1 = recordResult(EMPTY_STREAK, '2026-07-07', true);
    expect(day1).toEqual({current: 1, best: 1, lastCompletedDateKey: '2026-07-07'});
    const day2 = recordResult(day1, '2026-07-08', true);
    expect(day2).toEqual({current: 2, best: 2, lastCompletedDateKey: '2026-07-08'});
  });

  it('restarts at 1 after a gap and keeps best', () => {
    const prior = {current: 5, best: 5, lastCompletedDateKey: '2026-07-01'};
    const afterGap = recordResult(prior, '2026-07-07', true);
    expect(afterGap).toEqual({current: 1, best: 5, lastCompletedDateKey: '2026-07-07'});
  });

  it('breaks the streak on a loss without touching best', () => {
    const prior = {current: 3, best: 4, lastCompletedDateKey: '2026-07-06'};
    expect(recordResult(prior, '2026-07-07', false)).toEqual({
      current: 0,
      best: 4,
      lastCompletedDateKey: '2026-07-06',
    });
  });
});

describe('history', () => {
  it('derives an entry from a finished state', () => {
    let s = createInitialState('2026-07-07', SECRET);
    s = applyGuess(s, OTHER);
    s = applyGuess(s, SECRET);
    expect(historyEntryFor(s)).toEqual({dateKey: '2026-07-07', status: 'won', guessCount: 2});
  });

  it('upserts a day into the log without mutating the input', () => {
    const log: HistoryLog = {'2026-07-06': {dateKey: '2026-07-06', status: 'won', guessCount: 3}};
    const next = upsertHistory(log, {dateKey: '2026-07-07', status: 'lost', guessCount: 6});
    expect(Object.keys(next)).toHaveLength(2);
    expect(next['2026-07-07'].status).toBe('lost');
    // Original untouched.
    expect(Object.keys(log)).toHaveLength(1);
    // Same day overwrites.
    const replaced = upsertHistory(next, {dateKey: '2026-07-07', status: 'won', guessCount: 4});
    expect(replaced['2026-07-07']).toEqual({dateKey: '2026-07-07', status: 'won', guessCount: 4});
  });
});
