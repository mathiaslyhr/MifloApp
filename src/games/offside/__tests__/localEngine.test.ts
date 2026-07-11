import {
  advanceLocalOffside,
  createLocalOffsideGame,
  createLocalOffsideRematch,
  handoffPlayer,
  LOCAL_MIN_PLAYERS,
  revealQuestion,
  submitLocalAnswer,
} from '../localEngine';
import {MAX_POINTS, QUESTION_DURATION_MS} from '../types';
import type {LocalOffsideState} from '../localEngine';

/** Deterministic rng: cycles a fixed sequence of [0,1) values. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const NAMES = ['Ana', 'Ben'];
const T0 = 1_000_000;

/** Everyone answers the current round; `pick` decides each player's tap. */
function playRound(
  state: LocalOffsideState,
  pick: (playerId: string, round: LocalOffsideState['deck'][number]) => number | null,
): LocalOffsideState {
  let s = state;
  const current = s.deck[s.round - 1];
  for (let i = 0; i < s.order.length; i++) {
    s = revealQuestion(s, T0);
    s = submitLocalAnswer(s, pick(s.order[s.handoffIndex], current), T0);
  }
  return s;
}

describe('createLocalOffsideGame', () => {
  it('is deterministic for a seeded rng', () => {
    const a = createLocalOffsideGame(NAMES, 5, seq([0.1, 0.5, 0.9, 0.3]));
    const b = createLocalOffsideGame(NAMES, 5, seq([0.1, 0.5, 0.9, 0.3]));
    expect(a).toEqual(b);
  });

  it('deals a valid deck and zeroed board', () => {
    const s = createLocalOffsideGame(NAMES, 5, seq([0.7, 0.2, 0.4]));
    expect(s.players.map(p => p.name)).toEqual(NAMES);
    expect(s.rounds).toBe(s.deck.length);
    expect(s.rounds).toBeGreaterThan(0);
    for (const round of s.deck) {
      expect(round.cards).toHaveLength(4);
      expect(round.outlierIndex).toBeGreaterThanOrEqual(0);
      expect(round.outlierIndex).toBeLessThan(4);
    }
    expect([...s.order].sort()).toEqual(s.players.map(p => p.userId).sort());
    expect(s.stage).toBe('question');
    expect(s.round).toBe(1);
    expect(s.contentShown).toBe(false);
    expect(s.deadline).toBeNull();
    expect(Object.values(s.scores)).toEqual([0, 0]);
  });

  it('trims names and rejects fewer than the minimum', () => {
    expect(() => createLocalOffsideGame(['A', '   '], 5)).toThrow();
    expect(LOCAL_MIN_PLAYERS).toBe(2);
    const s = createLocalOffsideGame(['  Ana ', 'Ben '], 5);
    expect(s.players.map(p => p.name)).toEqual(['Ana', 'Ben']);
  });

  it('rejects a round count outside 5 to 20', () => {
    expect(() => createLocalOffsideGame(NAMES, 4)).toThrow();
    expect(() => createLocalOffsideGame(NAMES, 21)).toThrow();
    expect(createLocalOffsideGame(NAMES, 20).rounds).toBe(20);
  });
});

describe('revealQuestion', () => {
  it('starts the personal clock at card reveal, not at the gate', () => {
    const s = createLocalOffsideGame(NAMES, 5, seq([0.5]));
    expect(s.deadline).toBeNull();
    const shown = revealQuestion(s, T0);
    expect(shown.contentShown).toBe(true);
    expect(shown.deadline).toBe(T0 + QUESTION_DURATION_MS);
  });

  it('is a no-op when the cards are already up or outside questions', () => {
    const shown = revealQuestion(createLocalOffsideGame(NAMES, 5, seq([0.5])), T0);
    expect(revealQuestion(shown, T0 + 1000)).toBe(shown);
  });
});

describe('submitLocalAnswer', () => {
  it('scores exactly like online: instant 1000, half-time 750, wrong 0, timeout 0', () => {
    let s = createLocalOffsideGame(['Ana', 'Ben', 'Cai', 'Dee'], 5, seq([0.5, 0.2]));
    const outlier = s.deck[0].outlierIndex;
    const wrong = (outlier + 1) % 4;

    // Instant correct tap.
    const p1 = s.order[0];
    s = submitLocalAnswer(revealQuestion(s, T0), outlier, T0);
    expect(s.answers[p1]).toEqual({option: outlier, points: MAX_POINTS});

    // Correct at half time.
    const p2 = s.order[1];
    s = revealQuestion(s, T0);
    s = submitLocalAnswer(s, outlier, T0 + QUESTION_DURATION_MS / 2);
    expect(s.answers[p2]).toEqual({option: outlier, points: 750});

    // Wrong tap.
    const p3 = s.order[2];
    s = submitLocalAnswer(revealQuestion(s, T0), wrong, T0);
    expect(s.answers[p3]).toEqual({option: wrong, points: 0});

    // Clock ran out.
    const p4 = s.order[3];
    s = submitLocalAnswer(revealQuestion(s, T0), null, T0 + QUESTION_DURATION_MS);
    expect(s.answers[p4]).toEqual({option: null, points: 0});
  });

  it('is a no-op behind the gate', () => {
    const gated = createLocalOffsideGame(NAMES, 5, seq([0.5]));
    expect(submitLocalAnswer(gated, 0, T0)).toBe(gated);
  });

  it('ignores a second submit for the same turn (tap vs timeout race)', () => {
    let s = createLocalOffsideGame(['Ana', 'Ben', 'Cai'], 5, seq([0.5]));
    const outlier = s.deck[0].outlierIndex;
    s = revealQuestion(s, T0);
    const first = s.order[0];
    s = submitLocalAnswer(s, outlier, T0);
    // The turn already passed to the next player; a late timeout for the same
    // gate-up state must not overwrite anything.
    expect(s.handoffIndex).toBe(1);
    const late = submitLocalAnswer({...s, handoffIndex: 0, contentShown: true, deadline: T0}, null, T0);
    expect(late.answers[first]).toEqual({option: outlier, points: MAX_POINTS});
  });

  it('re-arms the gate between players and resolves the round on the last answer', () => {
    let s = createLocalOffsideGame(NAMES, 5, seq([0.5]));
    const outlier = s.deck[0].outlierIndex;
    const [first, second] = s.order;

    s = submitLocalAnswer(revealQuestion(s, T0), outlier, T0);
    expect(s.stage).toBe('question');
    expect(s.handoffIndex).toBe(1);
    expect(s.contentShown).toBe(false);
    expect(s.deadline).toBeNull();
    expect(handoffPlayer(s)?.userId).toBe(second);

    s = submitLocalAnswer(revealQuestion(s, T0), (outlier + 1) % 4, T0);
    expect(s.stage).toBe('reveal');
    expect(s.scores[first]).toBe(MAX_POINTS);
    expect(s.scores[second]).toBe(0);
  });
});

describe('advanceLocalOffside', () => {
  it('walks reveal, scoreboard, next question with a fresh gate and answers', () => {
    let s = createLocalOffsideGame(NAMES, 5, seq([0.5]));
    s = playRound(s, (_, round) => round.outlierIndex);
    expect(s.stage).toBe('reveal');
    s = advanceLocalOffside(s);
    expect(s.stage).toBe('scoreboard');
    s = advanceLocalOffside(s);
    expect(s.stage).toBe('question');
    expect(s.round).toBe(2);
    expect(s.answers).toEqual({});
    expect(s.handoffIndex).toBe(0);
    expect(s.contentShown).toBe(false);
    expect(s.deadline).toBeNull();
  });

  it('lands on the standings after the last round with accumulated totals', () => {
    let s = createLocalOffsideGame(NAMES, 5, seq([0.5]));
    const winner = s.order[0];
    while (s.stage !== 'standings') {
      if (s.stage === 'question') {
        s = playRound(s, id => (id === winner ? s.deck[s.round - 1].outlierIndex : null));
      } else {
        s = advanceLocalOffside(s);
      }
    }
    expect(s.scores[winner]).toBe(s.rounds * MAX_POINTS);
    expect(s.scores[s.order[1]]).toBe(0);
  });

  it('is a no-op during questions and standings', () => {
    const s = createLocalOffsideGame(NAMES, 5, seq([0.5]));
    expect(advanceLocalOffside(s)).toBe(s);
  });
});

describe('createLocalOffsideRematch', () => {
  it('keeps the players, deals a fresh deck and resets the scores', () => {
    let s = createLocalOffsideGame(NAMES, 5, seq([0.5]));
    s = playRound(s, (_, round) => round.outlierIndex);
    const next = createLocalOffsideRematch(s, seq([0.9, 0.2, 0.6]));
    expect(next.players).toEqual(s.players);
    expect(next.rounds).toBe(next.deck.length);
    expect(next.stage).toBe('question');
    expect(next.round).toBe(1);
    expect(next.answers).toEqual({});
    expect(Object.values(next.scores)).toEqual([0, 0]);
  });
});
