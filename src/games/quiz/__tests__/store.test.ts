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
    const standings = rankContestants([s.you], s.prevRankById);
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
