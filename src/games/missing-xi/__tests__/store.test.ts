/**
 * @format
 */
import {useMissingStore} from '../store';
import type {MissingQuestion} from '../mockData';

const store = useMissingStore;

const deck: MissingQuestion[] = [
  {
    lineupId: 'test-xi',
    team: 'Test',
    competition: 'Friendly',
    year: 2020,
    formation: '4-3-3',
    players: [
      {name: 'Keeper', position: 'GK'},
      {name: 'Andrés Iniesta', position: 'MF'},
      {name: 'Mesut Özil', position: 'FW', aliases: ['Ozil']},
    ],
    hiddenIndex: 1, // Iniesta
  },
];
const roster = [
  {id: 'u1', name: 'Me', score: 0, isYou: true},
  {id: 'u2', name: 'Anna', score: 0},
];

describe('missing-xi store', () => {
  beforeEach(() => {
    store.getState().hydrate(deck, roster);
  });

  it('seeds the deck and contestants from the room', () => {
    const s = store.getState();
    expect(s.questions.length).toBe(1);
    expect(s.you.id).toBe('u1');
    expect(s.phase).toBe('question');
  });

  it('a correct typed guess (surname, any case) scores at reveal', () => {
    store.getState().lockAnswer('iniesta', 1);
    expect(store.getState().you.score).toBe(0); // not applied yet
    store.getState().reveal();
    expect(store.getState().you.score).toBe(1000);
  });

  it('a wrong guess scores zero', () => {
    store.getState().lockAnswer('Xavi', 1);
    store.getState().reveal();
    expect(store.getState().you.score).toBe(0);
  });

  it('an empty/timed-out guess scores zero', () => {
    store.getState().lockAnswer(null, 1);
    store.getState().reveal();
    expect(store.getState().you.score).toBe(0);
  });

  it('advances phases: reveal → standings → next', () => {
    store.getState().lockAnswer('iniesta', 0.5);
    store.getState().reveal();
    store.getState().showStandings();
    expect(store.getState().phase).toBe('standings');
    store.getState().next();
    const s = store.getState();
    expect(s.index).toBe(1);
    expect(s.phase).toBe('question');
    expect(s.guess).toBe(null);
  });
});
