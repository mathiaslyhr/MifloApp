import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  foundRanks,
  giveUp,
  historyEntryFor,
  isFinished,
  matchGuess,
  missCount,
  recordResult,
  STREAK_MISS_LIMIT,
  upsertHistory,
} from '../engine';
import type {TenballList, TenballState} from '../types';

const LIST: TenballList = {
  id: 'test-list',
  entries: [
    {rank: 1, name: 'Gerd Müller', value: '14', aliases: ['gerd muller', 'gerd']},
    {rank: 2, name: 'Ronaldo', value: '15', aliases: ['ronaldo', 'r9']},
    {rank: 3, name: 'Miroslav Klose', value: '16', aliases: ['klose', 'miroslav klose']},
    {rank: 4, name: 'Just Fontaine', value: '13', aliases: ['fontaine']},
    {rank: 5, name: 'Lionel Messi', value: '13', aliases: ['messi']},
    {rank: 6, name: 'Pelé', value: '12', aliases: ['pele']},
    {rank: 7, name: 'Kylian Mbappé', value: '12', aliases: ['mbappe']},
    {rank: 8, name: 'Sándor Kocsis', value: '11', aliases: ['kocsis']},
    {rank: 9, name: 'Jürgen Klinsmann', value: '11', aliases: ['klinsmann']},
    {rank: 10, name: 'Thomas Müller', value: '10', aliases: ['thomas muller']},
  ],
};

const start = () => createInitialState('2026-07-10', LIST.id);

describe('applyGuess', () => {
  it('reveals the matching rank on a hit', () => {
    const {state, outcome} = applyGuess(start(), LIST, 'Klose');
    expect(outcome).toBe('hit');
    expect(foundRanks(state).has(3)).toBe(true);
    expect(missCount(state)).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('matches accented and case-mangled input via folding', () => {
    expect(applyGuess(start(), LIST, '  GERD MÜLLER ').outcome).toBe('hit');
    expect(applyGuess(start(), LIST, 'Pelé').outcome).toBe('hit');
    expect(applyGuess(start(), LIST, 'MBAPPÉ').outcome).toBe('hit');
  });

  it('counts a wrong name as a miss without ending the game', () => {
    const {state, outcome} = applyGuess(start(), LIST, 'Maradona');
    expect(outcome).toBe('miss');
    expect(missCount(state)).toBe(1);
    expect(state.status).toBe('playing');
  });

  it('never double-counts a repeated wrong text', () => {
    const first = applyGuess(start(), LIST, 'Maradona').state;
    const {state, outcome} = applyGuess(first, LIST, ' maradona ');
    expect(outcome).toBe('repeat');
    expect(state).toBe(first);
    expect(missCount(state)).toBe(1);
  });

  it('reports a different alias of a found player as already-found', () => {
    const first = applyGuess(start(), LIST, 'ronaldo').state;
    const {state, outcome} = applyGuess(first, LIST, 'r9');
    expect(outcome).toBe('already-found');
    expect(state).toBe(first);
  });

  it('ignores blank input', () => {
    const {state, outcome} = applyGuess(start(), LIST, '   ');
    expect(outcome).toBe('repeat');
    expect(state.guesses).toHaveLength(0);
  });

  it('wins when the tenth rank is found, and locks further guesses', () => {
    let state = start();
    for (const text of ['gerd', 'r9', 'klose', 'fontaine', 'messi', 'pele', 'mbappe', 'kocsis', 'klinsmann']) {
      state = applyGuess(state, LIST, text).state;
    }
    expect(state.status).toBe('playing');
    const final = applyGuess(state, LIST, 'thomas muller');
    expect(final.outcome).toBe('hit');
    expect(final.state.status).toBe('won');
    expect(isFinished(final.state)).toBe(true);
    expect(applyGuess(final.state, LIST, 'anything').state).toBe(final.state);
  });

  it('replaying stored guess texts reproduces the state', () => {
    let live = start();
    for (const text of ['klose', 'nope', 'r9', 'nope 2']) {
      live = applyGuess(live, LIST, text).state;
    }
    let replayed = start();
    for (const guess of live.guesses) {
      replayed = applyGuess(replayed, LIST, guess.text).state;
    }
    expect(replayed).toEqual(live);
  });
});

describe('giveUp', () => {
  it('flips a live game to revealed, and only a live game', () => {
    const revealed = giveUp(start());
    expect(revealed.status).toBe('revealed');
    expect(giveUp(revealed)).toBe(revealed);
  });
});

describe('matchGuess', () => {
  it('finds ranks by alias and misses unknown text', () => {
    expect(matchGuess(LIST, 'kocsis')).toBe(8);
    expect(matchGuess(LIST, 'zidane')).toBeUndefined();
  });
});

describe('recordResult', () => {
  it('starts a streak at 1 on a clean win', () => {
    expect(recordResult(EMPTY_STREAK, '2026-07-10', 3, false)).toEqual({
      current: 1,
      best: 1,
      lastCompletedDateKey: '2026-07-10',
    });
  });

  it('extends when the previous day was completed', () => {
    const prev = {current: 4, best: 6, lastCompletedDateKey: '2026-07-09'};
    expect(recordResult(prev, '2026-07-10', 0, false)).toEqual({
      current: 5,
      best: 6,
      lastCompletedDateKey: '2026-07-10',
    });
  });

  it('restarts at 1 after a gap', () => {
    const prev = {current: 4, best: 6, lastCompletedDateKey: '2026-07-07'};
    expect(recordResult(prev, '2026-07-10', 0, false).current).toBe(1);
  });

  it('keeps the streak on exactly the miss limit', () => {
    const prev = {current: 2, best: 2, lastCompletedDateKey: '2026-07-09'};
    expect(recordResult(prev, '2026-07-10', STREAK_MISS_LIMIT, false).current).toBe(3);
  });

  it('breaks on 11+ misses or a give-up, best untouched', () => {
    const prev = {current: 5, best: 8, lastCompletedDateKey: '2026-07-09'};
    expect(recordResult(prev, '2026-07-10', STREAK_MISS_LIMIT + 1, false)).toEqual({
      ...prev,
      current: 0,
    });
    expect(recordResult(prev, '2026-07-10', 0, true)).toEqual({...prev, current: 0});
  });
});

describe('history', () => {
  it('captures found/miss counts and the outcome', () => {
    let state: TenballState = start();
    state = applyGuess(state, LIST, 'klose').state;
    state = applyGuess(state, LIST, 'wrong').state;
    state = giveUp(state);
    expect(historyEntryFor(state)).toEqual({
      dateKey: '2026-07-10',
      listId: LIST.id,
      status: 'revealed',
      found: 1,
      misses: 1,
    });
  });

  it('upserts by dateKey', () => {
    const a = {dateKey: 'd1', listId: 'l', status: 'won' as const, found: 10, misses: 2};
    const b = {...a, misses: 4};
    expect(upsertHistory(upsertHistory({}, a), b)).toEqual({d1: b});
  });
});
