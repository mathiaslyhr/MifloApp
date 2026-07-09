import {
  advanceAnswerReveal,
  applyRedemption,
  buildFootballerPool,
  cleanAnswer,
  eligibleFootballerIds,
  tally,
} from '../engine';
import {buildQuestionIds, QUESTION_IDS} from '../questions';
import {getById} from '../../../data/football';
import {ANSWER_MAX_LEN, MIN_POOL, SCORE} from '../types';
import type {ImposterState} from '../types';

function state(overrides: Partial<ImposterState> = {}): ImposterState {
  return {
    gameType: 'red-card',
    phase: 'answering',
    round: 1,
    rounds: 2,
    questionIds: ['q3', 'q7'],
    turnUserId: null,
    players: [
      {userId: 'a', name: 'A'},
      {userId: 'b', name: 'B'},
      {userId: 'c', name: 'C'},
    ],
    answeredCount: 0,
    answerIndex: 0,
    votedCount: 0,
    scores: {a: 0, b: 0, c: 0},
    ...overrides,
  };
}

/** A resolved round, as the server publishes it: answers out, host on turn. */
function revealState(overrides: Partial<ImposterState> = {}): ImposterState {
  return state({
    phase: 'answerReveal',
    turnUserId: 'a',
    answeredCount: 3,
    answers: [
      {userId: 'b', text: 'about 120m'},
      {userId: 'a', text: '80m'},
      {userId: 'c', text: 'maybe 60m'},
    ],
    answerIndex: 0,
    ...overrides,
  });
}

describe('cleanAnswer', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanAnswer('  80m  ')).toBe('80m');
  });

  it('rejects empty and whitespace-only answers', () => {
    expect(cleanAnswer('')).toBeNull();
    expect(cleanAnswer('   ')).toBeNull();
  });

  it('accepts exactly the cap and rejects one over', () => {
    expect(cleanAnswer('x'.repeat(ANSWER_MAX_LEN))).toHaveLength(ANSWER_MAX_LEN);
    expect(cleanAnswer('x'.repeat(ANSWER_MAX_LEN + 1))).toBeNull();
  });
});

describe('advanceAnswerReveal', () => {
  it('pages through the answers one by one', () => {
    let s = revealState();
    s = advanceAnswerReveal(s);
    expect(s).toMatchObject({phase: 'answerReveal', answerIndex: 1});
    s = advanceAnswerReveal(s);
    expect(s).toMatchObject({phase: 'answerReveal', answerIndex: 2});
  });

  it('rolls a non-final round into the next question with a locked turn', () => {
    const s = advanceAnswerReveal(revealState({answerIndex: 2}));
    expect(s).toMatchObject({
      phase: 'answering',
      round: 2,
      answeredCount: 0,
      answerIndex: 0,
      turnUserId: null,
    });
    // The shown answers leave the public state entirely.
    expect(s.answers).toBeUndefined();
  });

  it('moves to voting after the last answer of the final round', () => {
    const s = advanceAnswerReveal(revealState({round: 2, answerIndex: 2}));
    expect(s).toMatchObject({phase: 'voting', turnUserId: null});
    expect(s.answers).toBeUndefined();
  });

  it('is a no-op outside answerReveal or without published answers', () => {
    const answering = state();
    expect(advanceAnswerReveal(answering)).toBe(answering);
    const broken = state({phase: 'answerReveal'});
    expect(advanceAnswerReveal(broken)).toBe(broken);
  });
});

describe('buildQuestionIds', () => {
  const rng = () => 0.42;

  it('picks the requested number of distinct known ids', () => {
    for (const rounds of [2, 3, 4]) {
      const ids = buildQuestionIds(rounds, rng);
      expect(ids).toHaveLength(rounds);
      expect(new Set(ids).size).toBe(rounds);
      for (const id of ids) {
        expect(QUESTION_IDS).toContain(id);
      }
    }
  });

  it('never repeats an avoided id (the previous hand)', () => {
    const previous = buildQuestionIds(4, rng);
    const next = buildQuestionIds(4, rng, previous);
    for (const id of next) {
      expect(previous).not.toContain(id);
    }
  });

  it('is deterministic for a seeded rng', () => {
    expect(buildQuestionIds(3, () => 0.7)).toEqual(buildQuestionIds(3, () => 0.7));
  });
});

describe('tally', () => {
  const ids = ['a', 'b', 'c'];
  const zero = {a: 0, b: 0, c: 0};

  it('catches the imposter and rewards each detective who voted for them', () => {
    // imposter = b; a and c both vote b, b votes a.
    const {caught, deltas, scores} = tally(
      {a: 'b', c: 'b', b: 'a'},
      'b',
      ids,
      zero,
    );
    expect(caught).toBe(true);
    expect(deltas).toEqual({a: SCORE.detectiveCorrect, b: 0, c: SCORE.detectiveCorrect});
    expect(scores).toEqual({a: 1, b: 0, c: 1});
  });

  it('awards the imposter the escape bonus when the majority misses', () => {
    // imposter = b; the group piles onto c.
    const {caught, deltas, scores} = tally(
      {a: 'c', b: 'c', c: 'a'},
      'b',
      ids,
      zero,
    );
    expect(caught).toBe(false);
    expect(deltas).toEqual({a: 0, b: SCORE.imposterEscape, c: 0});
    expect(scores).toEqual({a: 0, b: 3, c: 0});
  });

  it('counts a tie at the top as caught (generous to detectives)', () => {
    // Every target gets one vote; the imposter is among the tied max.
    const {caught, deltas} = tally({a: 'b', b: 'c', c: 'a'}, 'b', ids, zero);
    expect(caught).toBe(true);
    expect(deltas).toEqual({a: SCORE.detectiveCorrect, b: 0, c: 0});
  });

  it('adds this hand to prior running totals', () => {
    const {scores} = tally({a: 'b', c: 'b', b: 'a'}, 'b', ids, {a: 5, b: 2, c: 0});
    expect(scores).toEqual({a: 6, b: 2, c: 1});
  });
});

describe('applyRedemption', () => {
  it('adds the redeem bonus to the imposter on a correct guess', () => {
    expect(applyRedemption({b: 0}, 'b', true)).toEqual({b: SCORE.imposterRedeem});
  });

  it('leaves scores untouched on a wrong guess', () => {
    const scores = {b: 3};
    expect(applyRedemption(scores, 'b', false)).toBe(scores);
  });
});

describe('buildFootballerPool', () => {
  it('returns only illustrated players that exist in the dataset', () => {
    const eligible = eligibleFootballerIds();
    const pool = buildFootballerPool(() => 0.42);
    expect(pool).toHaveLength(eligible.length);
    expect(new Set(pool)).toEqual(new Set(eligible));
    // Every candidate resolves to a real footballer (the reveal shows a portrait).
    expect(pool.every(id => getById(id) !== undefined)).toBe(true);
  });

  it('offers enough candidates to satisfy the server floor', () => {
    expect(buildFootballerPool().length).toBeGreaterThanOrEqual(MIN_POOL);
  });
});
