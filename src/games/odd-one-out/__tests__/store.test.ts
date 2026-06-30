/**
 * @format
 */
import {useOddStore} from '../store';
import {rankContestants} from '../../quiz/scoring';
import type {OddRound} from '../mockData';

const store = useOddStore;

function currentRound() {
  const s = store.getState();
  return s.rounds[s.index];
}

describe('odd-one-out store phase machine', () => {
  beforeEach(() => {
    store.getState().start(5, 'Mathias');
  });

  it('starts in the question phase with a deck and zero scores', () => {
    const s = store.getState();
    expect(s.phase).toBe('question');
    expect(s.rounds.length).toBe(5);
    expect(s.you.score).toBe(0);
    expect(s.answered).toBe(false);
  });

  it('picking the outlier scores; reveal applies points once', () => {
    store.getState().lockAnswer(currentRound().outlierIndex, 1);
    const locked = store.getState();
    expect(locked.answered).toBe(true);
    expect(locked.you.score).toBe(0); // not applied yet

    store.getState().reveal();
    store.getState().reveal(); // idempotent
    const revealed = store.getState();
    expect(revealed.phase).toBe('reveal');
    expect(revealed.you.score).toBe(1000); // correct + instant
  });

  it('picking a non-outlier scores zero', () => {
    const round = currentRound();
    const wrong = (round.outlierIndex + 1) % 4;
    store.getState().lockAnswer(wrong, 1);
    store.getState().reveal();
    expect(store.getState().you.score).toBe(0);
  });

  it('advances phases and rounds: reveal → standings → next', () => {
    store.getState().lockAnswer(0, 0.5);
    store.getState().reveal();
    store.getState().showStandings();
    expect(store.getState().phase).toBe('standings');

    store.getState().next();
    const s = store.getState();
    expect(s.index).toBe(1);
    expect(s.phase).toBe('question');
    expect(s.answered).toBe(false);
    expect(s.selected).toBe(null);
  });
});

describe('odd-one-out networked hydrate + sync', () => {
  const deck: OddRound[] = [
    {
      cards: [
        {footballerId: 'a', name: 'A'},
        {footballerId: 'b', name: 'B'},
        {footballerId: 'c', name: 'C'},
        {footballerId: 'd', name: 'D'},
      ],
      outlierIndex: 2,
      criterion: {kind: 'honour', honour: 'champions-league'},
      explanation: 'Three of them won the Champions League.',
      topic: 'Honours',
    },
  ];
  const roster = [
    {id: 'u1', name: 'Me', score: 0, isYou: true},
    {id: 'u2', name: 'Anna', score: 0},
  ];

  beforeEach(() => {
    store.getState().hydrate(deck, roster);
  });

  it('seeds the deck and contestants from the room', () => {
    const s = store.getState();
    expect(s.rounds.length).toBe(1);
    expect(s.count).toBe(1);
    expect(s.you.id).toBe('u1');
  });

  it('ranks you first after a correct, instant answer', () => {
    store.getState().lockAnswer(2, 1); // the outlier
    store.getState().reveal();
    const s = store.getState();
    const standings = rankContestants(s.contestants, s.prevRankById);
    expect(standings[0].contestant.isYou).toBe(true);
  });

  it('merges others’ live scores without clobbering your local score', () => {
    store.getState().lockAnswer(2, 1);
    store.getState().reveal(); // you: 1000 locally
    store.getState().syncContestants([
      {id: 'u1', name: 'Me', score: 0, isYou: true},
      {id: 'u2', name: 'Anna', score: 700},
    ]);
    const s = store.getState();
    expect(s.you.score).toBe(1000);
    expect(s.contestants.find(c => c.id === 'u2')?.score).toBe(700);
  });
});
