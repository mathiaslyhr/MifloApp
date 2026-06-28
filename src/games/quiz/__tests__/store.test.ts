/**
 * @format
 */
import {useQuizStore} from '../store';
import {rankContestants} from '../scoring';

const store = useQuizStore;

function currentQuestion() {
  const s = store.getState();
  return s.questions[s.index];
}

describe('quiz store phase machine', () => {
  beforeEach(() => {
    store.getState().start(['all'], 5, 'Mathias');
  });

  it('starts in the question phase with a deck and zero scores', () => {
    const s = store.getState();
    expect(s.phase).toBe('question');
    expect(s.questions.length).toBe(5);
    expect(s.you.score).toBe(0);
    expect(s.answered).toBe(false);
  });

  it('locking an answer does not change the score until reveal', () => {
    store.getState().lockAnswer(currentQuestion().correctIndex, 1);
    const locked = store.getState();
    expect(locked.answered).toBe(true);
    expect(locked.phase).toBe('question');
    expect(locked.you.score).toBe(0); // not applied yet

    store.getState().reveal();
    const revealed = store.getState();
    expect(revealed.phase).toBe('reveal');
    expect(revealed.you.score).toBe(1000); // correct + instant
    expect(revealed.lastPoints).toBe(1000);
  });

  it('reveal is idempotent — points are applied once', () => {
    store.getState().lockAnswer(currentQuestion().correctIndex, 1);
    store.getState().reveal();
    store.getState().reveal();
    expect(store.getState().you.score).toBe(1000);
  });

  it('ranks the player into the standings after reveal', () => {
    store.getState().lockAnswer(currentQuestion().correctIndex, 1);
    store.getState().reveal();
    const s = store.getState();
    const standings = rankContestants(s.contestants, s.prevRankById);
    expect(standings[0].contestant.isYou).toBe(true);
    expect(standings[0].rank).toBe(1);
  });

  it('advances phases and questions: reveal → standings → next question', () => {
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

  it('a wrong/empty answer scores zero', () => {
    store.getState().lockAnswer(null, 1);
    store.getState().reveal();
    expect(store.getState().you.score).toBe(0);
  });
});

describe('quiz store networked hydrate + sync', () => {
  const deck = [
    {topic: 't', prompt: 'q1', options: ['a', 'b'], correctIndex: 0},
    {topic: 't', prompt: 'q2', options: ['a', 'b'], correctIndex: 1},
  ];
  const roster = [
    {id: 'u1', name: 'Me', score: 0, isYou: true},
    {id: 'u2', name: 'Anna', score: 0},
  ];

  beforeEach(() => {
    useQuizStore.getState().hydrate(deck, roster);
  });

  it('seeds the deck and contestants from the room', () => {
    const s = useQuizStore.getState();
    expect(s.questions.length).toBe(2);
    expect(s.count).toBe(2);
    expect(s.contestants.map(c => c.name)).toEqual(['Me', 'Anna']);
    expect(s.you.id).toBe('u1');
  });

  it('applies your points to your contestant at reveal', () => {
    useQuizStore.getState().lockAnswer(0, 1); // q1 correct
    useQuizStore.getState().reveal();
    const me = useQuizStore.getState().contestants.find(c => c.isYou);
    expect(me?.score).toBe(1000);
  });

  it('merges others’ live scores without clobbering your local score', () => {
    useQuizStore.getState().lockAnswer(0, 1);
    useQuizStore.getState().reveal(); // you: 1000 locally
    // A stale broadcast still shows you at 0, Anna now at 700.
    useQuizStore.getState().syncContestants([
      {id: 'u1', name: 'Me', score: 0, isYou: true},
      {id: 'u2', name: 'Anna', score: 700},
    ]);
    const s = useQuizStore.getState();
    expect(s.you.score).toBe(1000); // local kept
    expect(s.contestants.find(c => c.id === 'u2')?.score).toBe(700); // synced
  });
});
