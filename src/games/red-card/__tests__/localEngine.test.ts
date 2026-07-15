import {
  advanceLocalAnswerReveal,
  applyLocalRedemption,
  castLocalVote,
  createLocalGame,
  createLocalRematch,
  hideAndPass,
  LOCAL_MIN_PLAYERS,
  localRole,
  showContent,
  submitLocalAnswer,
} from '../localEngine';
import {awaitingRedemption, eligibleFootballerIds} from '../engine';
import {QUESTION_IDS} from '../questions';
import {ANSWER_MAX_LEN, SCORE} from '../types';
import type {LocalRedCardState} from '../localEngine';

/** Deterministic rng: cycles a fixed sequence of [0,1) values. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const NAMES = ['Ana', 'Ben', 'Cai'];

/** Walk a fresh game through every role handoff into the first question round. */
function intoAnswering(state: LocalRedCardState): LocalRedCardState {
  let s = state;
  for (let i = 0; i < s.order.length; i++) {
    s = hideAndPass(showContent(s));
  }
  return s;
}

/** One full round: everyone answers, then page through the whole reveal. */
function playRound(state: LocalRedCardState): LocalRedCardState {
  let s = state;
  for (let i = 0; i < s.order.length; i++) {
    s = submitLocalAnswer(showContent(s), `answer ${i}`);
  }
  while (s.phase === 'answerReveal') {
    s = advanceLocalAnswerReveal(s);
  }
  return s;
}

/** Walk every question round to its end, landing on voting. */
function intoVoting(state: LocalRedCardState): LocalRedCardState {
  let s = state;
  while (s.phase === 'answering') {
    s = playRound(s);
  }
  return s;
}

/** Every voter votes for `pick(voterId)`; returns the resolved state. */
function voteAll(
  state: LocalRedCardState,
  pick: (voterId: string) => string,
): LocalRedCardState {
  let s = state;
  while (s.phase === 'voting') {
    s = showContent(s);
    s = castLocalVote(s, pick(s.order[s.handoffIndex]));
  }
  return s;
}

describe('createLocalGame', () => {
  it('is deterministic for a seeded rng', () => {
    const a = createLocalGame(NAMES, 2, seq([0.1, 0.5, 0.9, 0.3]));
    const b = createLocalGame(NAMES, 2, seq([0.1, 0.5, 0.9, 0.3]));
    expect(a).toEqual(b);
  });

  it('deals a valid hand: imposter is a player, secret is illustrated, order is a permutation', () => {
    const s = createLocalGame(NAMES, 2, seq([0.7, 0.2, 0.4]));
    expect(s.players.map(p => p.name)).toEqual(NAMES);
    expect(s.players.some(p => p.userId === s.imposterId)).toBe(true);
    expect(eligibleFootballerIds()).toContain(s.footballerId);
    expect([...s.order].sort()).toEqual(s.players.map(p => p.userId).sort());
    // The hand opens on the role round-trip, inside the shared answering phase.
    expect(s.phase).toBe('answering');
    expect(s.roleTrip).toBe(true);
    expect(s.contentShown).toBe(false);
    expect(Object.values(s.scores)).toEqual([0, 0, 0]);
  });

  it('deals one distinct known question per round', () => {
    const s = createLocalGame(NAMES, 3, seq([0.7, 0.2, 0.4]));
    expect(s.rounds).toBe(3);
    expect(s.questionIds).toHaveLength(3);
    expect(new Set(s.questionIds).size).toBe(3);
    for (const id of s.questionIds) {
      expect(QUESTION_IDS).toContain(id);
    }
    expect(s.drafts).toEqual({});
    expect(s.answers).toBeUndefined();
  });

  it('trims names and rejects fewer than the minimum', () => {
    expect(() => createLocalGame(['A', '  ', 'B'], 2)).toThrow();
    expect(LOCAL_MIN_PLAYERS).toBe(3);
    const s = createLocalGame(['  Ana ', 'Ben', 'Cai '], 2);
    expect(s.players.map(p => p.name)).toEqual(['Ana', 'Ben', 'Cai']);
  });

  it('rejects a round count outside 2 to 10', () => {
    expect(() => createLocalGame(NAMES, 1)).toThrow();
    expect(() => createLocalGame(NAMES, 11)).toThrow();
    expect(createLocalGame(NAMES, 10).rounds).toBe(10);
  });
});

describe('localRole', () => {
  it('names the imposter as such and hands every detective the secret', () => {
    const s = createLocalGame(NAMES, 2, seq([0.5, 0.1, 0.8]));
    expect(localRole(s, s.imposterId)).toEqual({role: 'imposter'});
    for (const p of s.players.filter(p => p.userId !== s.imposterId)) {
      expect(localRole(s, p.userId)).toEqual({
        role: 'detective',
        footballerId: s.footballerId,
      });
    }
  });
});

describe('role handoffs', () => {
  it('walks every player once, then starts the first question round', () => {
    let s = createLocalGame(NAMES, 2, seq([0.5]));
    for (let i = 0; i < s.order.length; i++) {
      expect(s.roleTrip).toBe(true);
      expect(s.handoffIndex).toBe(i);
      expect(s.contentShown).toBe(false);
      s = showContent(s);
      expect(s.contentShown).toBe(true);
      s = hideAndPass(s);
    }
    expect(s.roleTrip).toBe(false);
    expect(s.phase).toBe('answering');
    expect(s.round).toBe(1);
    expect(s.handoffIndex).toBe(0);
    expect(s.contentShown).toBe(false);
  });

  it('hideAndPass is a no-op while the pass gate is up', () => {
    const s = createLocalGame(NAMES, 2, seq([0.5]));
    expect(hideAndPass(s)).toBe(s);
  });

  it('hideAndPass is a no-op once the role trip is over', () => {
    const shown = showContent(intoAnswering(createLocalGame(NAMES, 2, seq([0.5]))));
    expect(hideAndPass(shown)).toBe(shown);
  });
});

describe('submitLocalAnswer', () => {
  it('drafts each answer behind the gate and re-arms it for the next player', () => {
    let s = intoAnswering(createLocalGame(NAMES, 2, seq([0.5])));
    const first = s.order[0];
    s = submitLocalAnswer(showContent(s), '  80m  ');
    expect(s.drafts[first]).toBe('80m');
    expect(s.phase).toBe('answering');
    expect(s.handoffIndex).toBe(1);
    expect(s.contentShown).toBe(false);
    // Nothing is public until everyone has answered.
    expect(s.answers).toBeUndefined();
    expect(s.answeredCount).toBe(1);
  });

  it('is a no-op behind the gate and for empty or over-long answers', () => {
    const gated = intoAnswering(createLocalGame(NAMES, 2, seq([0.5])));
    expect(submitLocalAnswer(gated, 'answer')).toBe(gated);
    const shown = showContent(gated);
    expect(submitLocalAnswer(shown, '   ')).toBe(shown);
    expect(submitLocalAnswer(shown, 'x'.repeat(ANSWER_MAX_LEN + 1))).toBe(shown);
  });

  it('is a no-op during the role trip', () => {
    const s = showContent(createLocalGame(NAMES, 2, seq([0.5])));
    expect(submitLocalAnswer(s, 'too early')).toBe(s);
  });

  it('the last answer publishes every answer in a shuffled order', () => {
    let s = intoAnswering(createLocalGame(NAMES, 2, seq([0.5])));
    for (let i = 0; i < s.order.length; i++) {
      s = submitLocalAnswer(showContent(s), `answer ${i}`);
    }
    expect(s.phase).toBe('answerReveal');
    expect(s.answerIndex).toBe(0);
    expect(s.answers).toBeDefined();
    // Published answers are a permutation of the players, each with its text.
    expect(s.answers!.map(a => a.userId).sort()).toEqual([...s.order].sort());
    for (const a of s.answers!) {
      expect(a.text).toMatch(/^answer \d$/);
    }
    // The drafts are spent.
    expect(s.drafts).toEqual({});
  });
});

describe('advanceLocalAnswerReveal', () => {
  it('pages every answer, then rolls into the next round with fresh drafts', () => {
    let s = intoAnswering(createLocalGame(NAMES, 2, seq([0.5])));
    for (let i = 0; i < s.order.length; i++) {
      s = submitLocalAnswer(showContent(s), `answer ${i}`);
    }
    const total = s.answers!.length;
    for (let i = 1; i < total; i++) {
      s = advanceLocalAnswerReveal(s);
      expect(s.phase).toBe('answerReveal');
      expect(s.answerIndex).toBe(i);
    }
    s = advanceLocalAnswerReveal(s);
    expect(s.phase).toBe('answering');
    expect(s.round).toBe(2);
    // Past the last answer, this round's texts leave the public state.
    expect(s.answers).toBeUndefined();
    expect(s.drafts).toEqual({});
    expect(s.answeredCount).toBe(0);
    expect(s.handoffIndex).toBe(0);
    expect(s.contentShown).toBe(false);
  });

  it('moves to voting after the final round', () => {
    const s = intoVoting(intoAnswering(createLocalGame(NAMES, 2, seq([0.5]))));
    expect(s.phase).toBe('voting');
    expect(s.handoffIndex).toBe(0);
    expect(s.contentShown).toBe(false);
  });

  it('a 3-round game walks three questions before voting', () => {
    let s = intoAnswering(createLocalGame(NAMES, 3, seq([0.5])));
    for (let round = 1; round <= 3; round++) {
      expect(s.phase).toBe('answering');
      expect(s.round).toBe(round);
      s = playRound(s);
    }
    expect(s.phase).toBe('voting');
  });

  it('is a no-op outside answerReveal', () => {
    const s = createLocalGame(NAMES, 2, seq([0.5]));
    expect(advanceLocalAnswerReveal(s)).toBe(s);
  });

  /**
   * The shared pager runs on the wider local state, so every branch of
   * `advanceAnswerReveal` must spread rather than rebuild. If it ever stops,
   * the secrets and the handoff bookkeeping vanish silently mid-hand.
   */
  it('carries the local extras through the shared pager', () => {
    let s = intoAnswering(createLocalGame(NAMES, 2, seq([0.5])));
    for (let i = 0; i < s.order.length; i++) {
      s = submitLocalAnswer(showContent(s), `answer ${i}`);
    }
    const before = s;
    const next = advanceLocalAnswerReveal(s);
    expect(next.imposterId).toBe(before.imposterId);
    expect(next.footballerId).toBe(before.footballerId);
    expect(next.order).toEqual(before.order);
    expect(next.usedQuestionIds).toEqual(before.usedQuestionIds);
    expect(next.roleTrip).toBe(false);
  });
});

describe('castLocalVote', () => {
  it('rejects self-votes and votes behind the pass gate', () => {
    const s = intoVoting(intoAnswering(createLocalGame(NAMES, 2, seq([0.5]))));
    const voter = s.order[0];
    // Gate still up: no vote.
    expect(castLocalVote(s, s.order[1])).toBe(s);
    // Self-vote: no vote.
    const shown = showContent(s);
    expect(castLocalVote(shown, voter)).toBe(shown);
  });

  it('everyone voting the imposter catches them and leaves a guess owed', () => {
    const s0 = intoVoting(
      intoAnswering(createLocalGame(NAMES, 2, seq([0.5, 0.1, 0.8]))),
    );
    const s = voteAll(s0, voter =>
      voter === s0.imposterId ? s0.order.find(id => id !== voter)! : s0.imposterId,
    );
    expect(s.phase).toBe('reveal');
    expect(awaitingRedemption(s)).toBe(true);
    expect(s.reveal).toMatchObject({caught: true});
    // The hand is over, so the secrets are public on the reveal.
    expect(s.reveal!.imposterId).toBe(s0.imposterId);
    expect(s.reveal!.footballerId).toBe(s0.footballerId);
    for (const p of s.players) {
      const expected = p.userId === s.imposterId ? 0 : SCORE.detectiveCorrect;
      expect(s.reveal!.deltas[p.userId]).toBe(expected);
      expect(s.scores[p.userId]).toBe(expected);
    }
  });

  it('an escaped imposter scores and owes no guess', () => {
    const s0 = intoVoting(
      intoAnswering(createLocalGame(NAMES, 2, seq([0.5, 0.1, 0.8]))),
    );
    // Everyone votes for one non-imposter scapegoat (the imposter votes for
    // another detective so nobody self-votes).
    const detectives = s0.players
      .filter(p => p.userId !== s0.imposterId)
      .map(p => p.userId);
    const scapegoat = detectives[0];
    const s = voteAll(s0, voter =>
      voter === scapegoat ? detectives[1] ?? s0.imposterId : scapegoat,
    );
    expect(s.phase).toBe('reveal');
    expect(awaitingRedemption(s)).toBe(false);
    expect(s.reveal).toMatchObject({caught: false});
    expect(s.scores[s.imposterId]).toBe(SCORE.imposterEscape);
    expect(s.reveal!.deltas[s.imposterId]).toBe(SCORE.imposterEscape);
  });
});

describe('applyLocalRedemption', () => {
  function caughtState(): LocalRedCardState {
    const s0 = intoVoting(
      intoAnswering(createLocalGame(NAMES, 2, seq([0.5, 0.1, 0.8]))),
    );
    return voteAll(s0, voter =>
      voter === s0.imposterId ? s0.order.find(id => id !== voter)! : s0.imposterId,
    );
  }

  it('a correct blind guess earns the redemption points', () => {
    const s = caughtState();
    const done = applyLocalRedemption(s, s.footballerId);
    expect(done.phase).toBe('reveal');
    expect(awaitingRedemption(done)).toBe(false);
    expect(done.reveal!.redemption).toEqual({
      guessId: s.footballerId,
      correct: true,
    });
    expect(done.scores[s.imposterId]).toBe(SCORE.imposterRedeem);
    expect(done.reveal!.deltas[s.imposterId]).toBe(SCORE.imposterRedeem);
  });

  it('a wrong guess reveals with no extra points', () => {
    const s = caughtState();
    const wrong = eligibleFootballerIds().find(id => id !== s.footballerId)!;
    const done = applyLocalRedemption(s, wrong);
    expect(done.phase).toBe('reveal');
    expect(awaitingRedemption(done)).toBe(false);
    expect(done.reveal!.redemption).toEqual({guessId: wrong, correct: false});
    expect(done.scores[s.imposterId]).toBe(0);
  });

  it('is a no-op when no guess is owed', () => {
    const s = createLocalGame(NAMES, 2, seq([0.5]));
    expect(applyLocalRedemption(s, 'anything')).toBe(s);
  });
});

describe('createLocalRematch', () => {
  it('keeps players, rounds and running scores, redeals secrets, avoids repeats', () => {
    const s0 = intoVoting(
      intoAnswering(createLocalGame(NAMES, 3, seq([0.5, 0.1, 0.8]))),
    );
    const done = voteAll(s0, voter =>
      voter === s0.imposterId ? s0.order.find(id => id !== voter)! : s0.imposterId,
    );
    const redeemed = applyLocalRedemption(done, done.footballerId);

    const next = createLocalRematch(redeemed, seq([0.9, 0.2, 0.6]));
    expect(next.players).toEqual(redeemed.players);
    expect(next.scores).toEqual(redeemed.scores);
    expect(next.rounds).toBe(3);
    expect(next.phase).toBe('answering');
    expect(next.roleTrip).toBe(true);
    expect(next.round).toBe(1);
    expect(next.votes).toEqual({});
    expect(next.drafts).toEqual({});
    expect(next.answers).toBeUndefined();
    expect(next.reveal).toBeUndefined();
    expect(next.footballerId).not.toBe(redeemed.footballerId);
    // Fresh questions: nothing from the hand everyone just played.
    for (const id of next.questionIds) {
      expect(redeemed.questionIds).not.toContain(id);
    }
    expect(next.players.some(p => p.userId === next.imposterId)).toBe(true);
  });

  it('accumulates asked questions across rematches so none repeat', () => {
    let s = createLocalGame(NAMES, 3, seq([0.5, 0.1, 0.8]));
    const seen = new Set<string>(s.questionIds);
    for (let hand = 0; hand < 5; hand++) {
      s = createLocalRematch(s, seq([0.3, 0.6, 0.9]));
      for (const id of s.questionIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      expect(s.usedQuestionIds).toHaveLength(seen.size);
    }
  });
});

/**
 * THE SECRET RULE, as a test. The secrets are local extras and must never leak
 * into the fields a room would broadcast — the only place they legitimately go
 * public is `reveal`, once the hand is over.
 */
describe('secret containment', () => {
  it('keeps the secrets out of the published answers', () => {
    let s = intoAnswering(createLocalGame(NAMES, 2, seq([0.5, 0.1, 0.8])));
    for (let i = 0; i < s.order.length; i++) {
      s = submitLocalAnswer(showContent(s), `answer ${i}`);
    }
    const published = JSON.stringify(s.answers);
    expect(published).not.toContain(s.footballerId);
    expect(s.answers!.every(a => a.userId !== s.footballerId)).toBe(true);
  });

  it('reveals the secrets only once the hand is over', () => {
    const s0 = intoVoting(
      intoAnswering(createLocalGame(NAMES, 2, seq([0.5, 0.1, 0.8]))),
    );
    // Mid-hand: no reveal block at all, so nothing public names the secret.
    expect(s0.reveal).toBeUndefined();
    const done = voteAll(s0, voter =>
      voter === s0.imposterId ? s0.order.find(id => id !== voter)! : s0.imposterId,
    );
    expect(done.reveal!.footballerId).toBe(s0.footballerId);
  });
});
