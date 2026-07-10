/**
 * @format
 */
import {
  deadlineTs,
  deltasOf,
  explanationFor,
  hasAnswered,
  standings,
  topicKeyFor,
} from '../engine';
import {fractionRemaining, scoreAnswer} from '../scoring';
import {QUESTION_DURATION_MS} from '../types';
import type {OffsideState} from '../types';

function fixtureState(overrides: Partial<OffsideState> = {}): OffsideState {
  return {
    gameType: 'offside',
    phase: 'question',
    round: 1,
    rounds: 2,
    deck: [],
    roundEndsAt: null,
    turnUserId: null,
    players: [
      {userId: 'u1', name: 'Anna'},
      {userId: 'u2', name: 'Bo'},
      {userId: 'u3', name: 'Carla'},
    ],
    answers: {
      u1: {option: 2, points: 830},
      u2: {option: null, points: 0},
    },
    answeredCount: 2,
    scores: {u1: 1200, u2: 1900, u3: 1200},
    ...overrides,
  };
}

describe('explanationFor', () => {
  it('maps each emitted honour subtype to its own key', () => {
    for (const honour of [
      'champions-league',
      'world-cup',
      'ballon-dor',
      'european-championship',
    ] as const) {
      expect(explanationFor({kind: 'honour', honour})).toEqual({
        key: `offside.explanation.honour.${honour}`,
      });
    }
  });

  it('interpolates the country for nationality rounds', () => {
    expect(explanationFor({kind: 'nationality', country: 'Brazil'})).toEqual({
      key: 'offside.explanation.nationality',
      params: {country: 'Brazil'},
    });
  });

  it('resolves the club name for club rounds', () => {
    expect(explanationFor({kind: 'club', clubId: 'man-utd'})).toEqual({
      key: 'offside.explanation.club',
      params: {club: 'Manchester United'},
    });
  });

  it('falls back to the raw id for an unknown club', () => {
    expect(explanationFor({kind: 'club', clubId: 'nowhere-fc'})).toEqual({
      key: 'offside.explanation.club',
      params: {club: 'nowhere-fc'},
    });
  });

  it('maps each position to its own key', () => {
    expect(explanationFor({kind: 'position', position: 'GK'})).toEqual({
      key: 'offside.explanation.position.GK',
    });
    expect(explanationFor({kind: 'position', position: 'FW'})).toEqual({
      key: 'offside.explanation.position.FW',
    });
  });

  it('never crashes on a criterion the generator does not emit', () => {
    expect(explanationFor({kind: 'treble'})).toEqual({
      key: 'offside.explanation.generic',
    });
  });
});

describe('topicKeyFor', () => {
  it('maps criterion kinds to topic chips', () => {
    expect(topicKeyFor({kind: 'honour', honour: 'world-cup'})).toBe(
      'offside.topic.honours',
    );
    expect(topicKeyFor({kind: 'nationality', country: 'Italy'})).toBe(
      'offside.topic.nationality',
    );
    expect(topicKeyFor({kind: 'club', clubId: 'arsenal'})).toBe(
      'offside.topic.clubs',
    );
    expect(topicKeyFor({kind: 'position', position: 'MF'})).toBe(
      'offside.topic.positions',
    );
  });
});

describe('scoreAnswer', () => {
  it('gives 0 for a wrong answer regardless of speed', () => {
    expect(scoreAnswer(false, 1)).toBe(0);
  });

  it('gives 1000 for an instant correct answer', () => {
    expect(scoreAnswer(true, 1)).toBe(1000);
  });

  it('gives 500 for a correct answer at the buzzer', () => {
    expect(scoreAnswer(true, 0)).toBe(500);
  });

  it('clamps fractions outside [0, 1]', () => {
    expect(scoreAnswer(true, 2)).toBe(1000);
    expect(scoreAnswer(true, -1)).toBe(500);
  });
});

describe('fractionRemaining', () => {
  it('is 1 with the full window left and 0 past the deadline', () => {
    const deadline = 100_000 + QUESTION_DURATION_MS;
    expect(fractionRemaining(deadline, 100_000)).toBe(1);
    expect(fractionRemaining(deadline, deadline)).toBe(0);
    expect(fractionRemaining(deadline, deadline + 5_000)).toBe(0);
  });

  it('is halfway through the window at 0.5', () => {
    const deadline = 100_000 + QUESTION_DURATION_MS;
    expect(fractionRemaining(deadline, 100_000 + QUESTION_DURATION_MS / 2)).toBe(
      0.5,
    );
  });
});

describe('standings', () => {
  it('sorts by score, ties broken by name', () => {
    const rows = standings(fixtureState());
    expect(rows.map(r => r.userId)).toEqual(['u2', 'u1', 'u3']);
    expect(rows[0].score).toBe(1900);
  });

  it('scores missing players as 0', () => {
    const rows = standings(fixtureState({scores: {}}));
    expect(rows).toHaveLength(3);
    expect(rows.every(r => r.score === 0)).toBe(true);
  });
});

describe('hasAnswered / deltasOf / deadlineTs', () => {
  it('hasAnswered is true for submitted answers, including null options', () => {
    const state = fixtureState();
    expect(hasAnswered(state, 'u1')).toBe(true);
    expect(hasAnswered(state, 'u2')).toBe(true);
    expect(hasAnswered(state, 'u3')).toBe(false);
  });

  it('deltasOf reports this round’s points per user', () => {
    expect(deltasOf(fixtureState())).toEqual({u1: 830, u2: 0});
  });

  it('deadlineTs parses the ISO deadline and is null-safe', () => {
    expect(deadlineTs(fixtureState())).toBeNull();
    const iso = '2026-07-10T12:00:20.000Z';
    expect(deadlineTs(fixtureState({roundEndsAt: iso}))).toBe(Date.parse(iso));
  });
});
