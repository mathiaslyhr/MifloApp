import type {FamousLineup} from '../../../data/football';
import {
  acceptedTokens,
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  foundSlots,
  giveUp,
  historyEntryFor,
  isFinished,
  matchGuess,
  missCount,
  recordResult,
  STREAK_MISS_LIMIT,
  upsertHistory,
} from '../engine';
import type {TeamsheetState} from '../types';

/** A synthetic XI covering the matching edge cases. */
const LINEUP: FamousLineup = {
  id: 'test-xi',
  team: 'Testland',
  competition: 'Test Final',
  year: 2020,
  formation: '4-3-3',
  match: {competitionKey: 'worldCupFinal', opponent: 'Otherland', goalsFor: 2, goalsAgainst: 1},
  players: [
    {name: 'Peter Schmeichel', position: 'GK', shirt: 1},
    {name: 'Gary Neville', position: 'DF', shirt: 2},
    {name: 'Phil Neville', position: 'DF', shirt: 12, aliases: ['Phil']},
    {name: 'Luka Modrić', position: 'DF', shirt: 10},
    {name: 'John Sivebæk', position: 'DF', shirt: 3, aliases: ['Sivebaek']},
    {name: 'Xavi', position: 'MF', shirt: 6, aliases: ['Xavi Hernández']},
    {name: 'Rodrigo De Paul', position: 'MF', shirt: 7, aliases: ['De Paul']},
    {name: 'Frank Lampard', position: 'MF', shirt: 8, captain: true},
    {name: 'Kylian Mbappé', position: 'FW', shirt: 10},
    {name: 'Erling Haaland', position: 'FW', shirt: 9},
    {name: 'Diego Milito', position: 'FW', shirt: 22, goals: 2},
  ],
};

const fresh = () => createInitialState('2026-07-09', LINEUP.id);

const play = (state: TeamsheetState, ...texts: string[]) => {
  let s = state;
  for (const text of texts) {
    s = applyGuess(s, LINEUP, text).state;
  }
  return s;
};

describe('acceptedTokens', () => {
  it('accepts the folded full name', () => {
    expect(matchGuess(LINEUP, 'peter schmeichel')).toBe(0);
    expect(matchGuess(LINEUP, 'erling haaland')).toBe(9);
  });

  it('accepts a unique surname, diacritic-insensitively', () => {
    expect(matchGuess(LINEUP, 'schmeichel')).toBe(0);
    expect(matchGuess(LINEUP, 'modric')).toBe(3);
    expect(matchGuess(LINEUP, 'mbappe')).toBe(8);
  });

  it('does not accept a surname two players share', () => {
    expect(matchGuess(LINEUP, 'neville')).toBeUndefined();
    expect(matchGuess(LINEUP, 'gary neville')).toBe(1);
    expect(matchGuess(LINEUP, 'phil neville')).toBe(2);
  });

  it('accepts curated aliases', () => {
    expect(matchGuess(LINEUP, 'phil')).toBe(2);
    expect(matchGuess(LINEUP, 'sivebaek')).toBe(4);
    expect(matchGuess(LINEUP, 'de paul')).toBe(6);
    expect(matchGuess(LINEUP, 'xavi hernandez')).toBe(5);
  });

  it('maps every token to exactly one slot', () => {
    const tokens = acceptedTokens(LINEUP);
    expect(tokens.get('xavi')).toBe(5);
    expect(tokens.get('lampard')).toBe(7);
  });
});

describe('applyGuess', () => {
  it('fills the slot on a hit and reports it', () => {
    const {state, outcome, slot} = applyGuess(fresh(), LINEUP, '  Modrić ');
    expect(outcome).toBe('hit');
    expect(slot).toBe(3);
    expect(foundSlots(state).has(3)).toBe(true);
    expect(missCount(state)).toBe(0);
  });

  it('counts an unknown name as a miss', () => {
    const {state, outcome} = applyGuess(fresh(), LINEUP, 'Zidane');
    expect(outcome).toBe('miss');
    expect(missCount(state)).toBe(1);
    expect(state.status).toBe('playing');
  });

  it('ignores a repeat of the same wrong text', () => {
    const once = applyGuess(fresh(), LINEUP, 'Zidane').state;
    const {state, outcome} = applyGuess(once, LINEUP, 'zidane');
    expect(outcome).toBe('repeat');
    expect(state).toBe(once);
    expect(missCount(state)).toBe(1);
  });

  it('treats an already-found player as a no-op, not a miss', () => {
    const once = applyGuess(fresh(), LINEUP, 'Haaland').state;
    const {state, outcome, slot} = applyGuess(once, LINEUP, 'Erling Haaland');
    expect(outcome).toBe('already-found');
    expect(slot).toBe(9);
    expect(state).toBe(once);
    expect(missCount(state)).toBe(0);
  });

  it('ignores blank input', () => {
    const {state, outcome} = applyGuess(fresh(), LINEUP, '   ');
    expect(outcome).toBe('repeat');
    expect(state.guesses).toHaveLength(0);
  });

  it('wins on the 11th slot', () => {
    const allButOne = play(
      fresh(),
      'Schmeichel',
      'Gary Neville',
      'Phil Neville',
      'Modric',
      'Sivebaek',
      'Xavi',
      'De Paul',
      'Lampard',
      'Mbappe',
      'Haaland',
    );
    expect(allButOne.status).toBe('playing');
    const {state} = applyGuess(allButOne, LINEUP, 'Milito');
    expect(state.status).toBe('won');
    expect(foundSlots(state).size).toBe(11);
    expect(isFinished(state)).toBe(true);
  });

  it('is a no-op once the game is finished', () => {
    const done = giveUp(fresh());
    const {state, outcome} = applyGuess(done, LINEUP, 'Lampard');
    expect(outcome).toBe('repeat');
    expect(state).toBe(done);
  });
});

describe('applyGuess with a targeted slot (strict positional mode)', () => {
  it('fills the targeted slot when the name matches it', () => {
    const {state, outcome, slot} = applyGuess(fresh(), LINEUP, 'Modric', 3);
    expect(outcome).toBe('hit');
    expect(slot).toBe(3);
    expect(foundSlots(state).has(3)).toBe(true);
    expect(missCount(state)).toBe(0);
  });

  it('counts a correct XI player at the wrong spot as a wrong-slot miss', () => {
    const {state, outcome, slot} = applyGuess(fresh(), LINEUP, 'Haaland', 3);
    expect(outcome).toBe('wrong-slot');
    expect(slot).toBeUndefined();
    expect(missCount(state)).toBe(1);
    expect(foundSlots(state).size).toBe(0);
    expect(state.guesses[0]).toEqual({text: 'haaland', target: 3});
  });

  it('counts an unknown name at a target as a plain miss', () => {
    const {outcome, state} = applyGuess(fresh(), LINEUP, 'Zidane', 3);
    expect(outcome).toBe('miss');
    expect(missCount(state)).toBe(1);
  });

  it('is a no-op to retry the same wrong text at the same target', () => {
    const once = applyGuess(fresh(), LINEUP, 'Haaland', 3).state;
    const {state, outcome} = applyGuess(once, LINEUP, 'haaland', 3);
    expect(outcome).toBe('repeat');
    expect(state).toBe(once);
    expect(missCount(state)).toBe(1);
  });

  it('re-evaluates the same text at a different target or untargeted', () => {
    const wrongSpot = applyGuess(fresh(), LINEUP, 'Haaland', 3).state;
    const {state, outcome, slot} = applyGuess(wrongSpot, LINEUP, 'Haaland');
    expect(outcome).toBe('hit');
    expect(slot).toBe(9);
    expect(foundSlots(state).has(9)).toBe(true);
    expect(missCount(state)).toBe(1);
  });

  it('treats a target that is already found as a no-op', () => {
    const found = applyGuess(fresh(), LINEUP, 'Modric', 3).state;
    const {state, outcome} = applyGuess(found, LINEUP, 'Haaland', 3);
    expect(outcome).toBe('already-found');
    expect(state).toBe(found);
  });

  it('replays stored targeted guesses deterministically', () => {
    // A wrong-spot miss must stay a miss on rehydrate — replay passes the
    // stored target back through, so the sheet state is reproduced exactly.
    let live = fresh();
    live = applyGuess(live, LINEUP, 'Haaland', 3).state; // wrong-slot miss
    live = applyGuess(live, LINEUP, 'Modric', 3).state; // targeted hit
    live = applyGuess(live, LINEUP, 'Xavi').state; // untargeted hit
    let replayed = fresh();
    for (const g of live.guesses) {
      replayed = applyGuess(replayed, LINEUP, g.text, g.target).state;
    }
    expect(replayed).toEqual(live);
    expect(missCount(replayed)).toBe(1);
    expect(foundSlots(replayed)).toEqual(new Set([3, 5]));
  });
});

describe('giveUp', () => {
  it('reveals the sheet', () => {
    const state = giveUp(play(fresh(), 'Xavi', 'Zidane'));
    expect(state.status).toBe('revealed');
    expect(foundSlots(state).size).toBe(1);
  });

  it('does nothing after a win or another give-up', () => {
    const revealed = giveUp(fresh());
    expect(giveUp(revealed)).toBe(revealed);
  });
});

describe('recordResult', () => {
  it('starts a streak on a clean first win', () => {
    const streak = recordResult(EMPTY_STREAK, '2026-07-09', 2, false);
    expect(streak).toEqual({current: 1, best: 1, lastCompletedDateKey: '2026-07-09'});
  });

  it('extends day over day and tracks best', () => {
    let streak = recordResult(EMPTY_STREAK, '2026-07-08', 0, false);
    streak = recordResult(streak, '2026-07-09', STREAK_MISS_LIMIT, false);
    expect(streak).toEqual({current: 2, best: 2, lastCompletedDateKey: '2026-07-09'});
  });

  it('restarts at 1 after a gap', () => {
    const monday = recordResult(EMPTY_STREAK, '2026-07-06', 0, false);
    const streak = recordResult(monday, '2026-07-09', 1, false);
    expect(streak.current).toBe(1);
  });

  it('breaks on too many misses but keeps best', () => {
    let streak = recordResult(EMPTY_STREAK, '2026-07-08', 0, false);
    streak = recordResult(streak, '2026-07-09', STREAK_MISS_LIMIT + 1, false);
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(1);
  });

  it('breaks on a give-up', () => {
    const streak = recordResult(
      {current: 4, best: 4, lastCompletedDateKey: '2026-07-08'},
      '2026-07-09',
      0,
      true,
    );
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(4);
  });
});

describe('history', () => {
  it('summarises a finished day', () => {
    const state = giveUp(play(fresh(), 'Xavi', 'Zidane', 'Puyol'));
    expect(historyEntryFor(state)).toEqual({
      dateKey: '2026-07-09',
      lineupId: 'test-xi',
      status: 'revealed',
      found: 1,
      misses: 2,
    });
  });

  it('upserts by dateKey', () => {
    const entry = historyEntryFor(giveUp(fresh()));
    const log = upsertHistory({}, entry);
    const updated = upsertHistory(log, {...entry, status: 'won', found: 11});
    expect(Object.keys(updated)).toHaveLength(1);
    expect(updated['2026-07-09'].status).toBe('won');
  });
});
