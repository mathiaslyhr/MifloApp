import {
  advanceAskLocal,
  applyLocalRedemption,
  castLocalVote,
  createLocalGame,
  createLocalRematch,
  hideAndPass,
  LOCAL_MIN_PLAYERS,
  showContent,
} from '../localEngine';
import {eligibleFootballerIds} from '../engine';
import {ROUNDS, SCORE} from '../types';
import type {LocalRedCardState} from '../localEngine';

/** Deterministic rng: cycles a fixed sequence of [0,1) values. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const NAMES = ['Ana', 'Ben', 'Cai'];

/** Walk a fresh game through every role handoff into the asking stage. */
function intoAsking(state: LocalRedCardState): LocalRedCardState {
  let s = state;
  for (let i = 0; i < s.order.length; i++) {
    s = hideAndPass(showContent(s));
  }
  return s;
}

/** Walk asking to its end (each player asks once per round). */
function intoVoting(state: LocalRedCardState): LocalRedCardState {
  let s = state;
  for (let i = 0; i < ROUNDS * s.order.length; i++) {
    s = advanceAskLocal(s);
  }
  return s;
}

/** Every voter votes for `pick(voterId)`; returns the resolved state. */
function voteAll(
  state: LocalRedCardState,
  pick: (voterId: string) => string,
): LocalRedCardState {
  let s = state;
  while (s.stage === 'voting') {
    s = showContent(s);
    s = castLocalVote(s, pick(s.order[s.handoffIndex]));
  }
  return s;
}

describe('createLocalGame', () => {
  it('is deterministic for a seeded rng', () => {
    const a = createLocalGame(NAMES, seq([0.1, 0.5, 0.9, 0.3]));
    const b = createLocalGame(NAMES, seq([0.1, 0.5, 0.9, 0.3]));
    expect(a).toEqual(b);
  });

  it('deals a valid hand: imposter is a player, secret is illustrated, order is a permutation', () => {
    const s = createLocalGame(NAMES, seq([0.7, 0.2, 0.4]));
    expect(s.players.map(p => p.name)).toEqual(NAMES);
    expect(s.players.some(p => p.id === s.imposterId)).toBe(true);
    expect(eligibleFootballerIds()).toContain(s.footballerId);
    expect([...s.order].sort()).toEqual(s.players.map(p => p.id).sort());
    expect(s.stage).toBe('roleReveal');
    expect(s.contentShown).toBe(false);
    expect(Object.values(s.scores)).toEqual([0, 0, 0]);
  });

  it('trims names and rejects fewer than the minimum', () => {
    expect(() => createLocalGame(['A', '  ', 'B'])).toThrow();
    expect(LOCAL_MIN_PLAYERS).toBe(3);
    const s = createLocalGame(['  Ana ', 'Ben', 'Cai ']);
    expect(s.players.map(p => p.name)).toEqual(['Ana', 'Ben', 'Cai']);
  });
});

describe('role handoffs', () => {
  it('walks every player once, then starts the asking rounds', () => {
    let s = createLocalGame(NAMES, seq([0.5]));
    for (let i = 0; i < s.order.length; i++) {
      expect(s.stage).toBe('roleReveal');
      expect(s.handoffIndex).toBe(i);
      expect(s.contentShown).toBe(false);
      s = showContent(s);
      expect(s.contentShown).toBe(true);
      s = hideAndPass(s);
    }
    expect(s.stage).toBe('asking');
    expect(s.round).toBe(1);
    expect(s.turnIndex).toBe(0);
    expect(s.contentShown).toBe(false);
  });

  it('hideAndPass is a no-op while the pass gate is up', () => {
    const s = createLocalGame(NAMES, seq([0.5]));
    expect(hideAndPass(s)).toBe(s);
  });
});

describe('advanceAskLocal', () => {
  it('cycles every player each round, then moves to voting', () => {
    let s = intoAsking(createLocalGame(NAMES, seq([0.5])));
    for (let round = 1; round <= ROUNDS; round++) {
      for (let i = 0; i < s.order.length; i++) {
        expect(s.stage).toBe('asking');
        expect(s.round).toBe(round);
        expect(s.turnIndex).toBe(i);
        s = advanceAskLocal(s);
      }
    }
    expect(s.stage).toBe('voting');
    expect(s.handoffIndex).toBe(0);
  });

  it('is a no-op outside asking', () => {
    const s = createLocalGame(NAMES, seq([0.5]));
    expect(advanceAskLocal(s)).toBe(s);
  });
});

describe('castLocalVote', () => {
  it('rejects self-votes and votes behind the pass gate', () => {
    const s = intoVoting(intoAsking(createLocalGame(NAMES, seq([0.5]))));
    const voter = s.order[0];
    // Gate still up: no vote.
    expect(castLocalVote(s, s.order[1])).toBe(s);
    // Self-vote: no vote.
    const shown = showContent(s);
    expect(castLocalVote(shown, voter)).toBe(shown);
  });

  it('everyone voting the imposter catches them and routes to redemption', () => {
    const s0 = intoVoting(intoAsking(createLocalGame(NAMES, seq([0.5, 0.1, 0.8]))));
    const s = voteAll(s0, voter =>
      voter === s0.imposterId ? s0.order.find(id => id !== voter)! : s0.imposterId,
    );
    expect(s.stage).toBe('redemption');
    expect(s.reveal).toMatchObject({caught: true});
    for (const p of s.players) {
      const expected =
        p.id === s.imposterId ? 0 : SCORE.detectiveCorrect;
      expect(s.reveal!.deltas[p.id]).toBe(expected);
      expect(s.scores[p.id]).toBe(expected);
    }
  });

  it('an escaped imposter scores and goes straight to the reveal', () => {
    const s0 = intoVoting(intoAsking(createLocalGame(NAMES, seq([0.5, 0.1, 0.8]))));
    // Everyone votes for one non-imposter scapegoat (the imposter votes for
    // another detective so nobody self-votes).
    const detectives = s0.players.filter(p => p.id !== s0.imposterId).map(p => p.id);
    const scapegoat = detectives[0];
    const s = voteAll(s0, voter =>
      voter === scapegoat ? detectives[1] ?? s0.imposterId : scapegoat,
    );
    expect(s.stage).toBe('reveal');
    expect(s.reveal).toMatchObject({caught: false});
    expect(s.scores[s.imposterId]).toBe(SCORE.imposterEscape);
    expect(s.reveal!.deltas[s.imposterId]).toBe(SCORE.imposterEscape);
  });
});

describe('applyLocalRedemption', () => {
  function caughtState(): LocalRedCardState {
    const s0 = intoVoting(intoAsking(createLocalGame(NAMES, seq([0.5, 0.1, 0.8]))));
    return voteAll(s0, voter =>
      voter === s0.imposterId ? s0.order.find(id => id !== voter)! : s0.imposterId,
    );
  }

  it('a correct blind guess earns the redemption points', () => {
    const s = caughtState();
    const done = applyLocalRedemption(s, s.footballerId);
    expect(done.stage).toBe('reveal');
    expect(done.reveal!.redemption).toEqual({guessId: s.footballerId, correct: true});
    expect(done.scores[s.imposterId]).toBe(SCORE.imposterRedeem);
    expect(done.reveal!.deltas[s.imposterId]).toBe(SCORE.imposterRedeem);
  });

  it('a wrong guess reveals with no extra points', () => {
    const s = caughtState();
    const wrong = eligibleFootballerIds().find(id => id !== s.footballerId)!;
    const done = applyLocalRedemption(s, wrong);
    expect(done.stage).toBe('reveal');
    expect(done.reveal!.redemption).toEqual({guessId: wrong, correct: false});
    expect(done.scores[s.imposterId]).toBe(0);
  });

  it('is a no-op outside the redemption stage', () => {
    const s = createLocalGame(NAMES, seq([0.5]));
    expect(applyLocalRedemption(s, 'anything')).toBe(s);
  });
});

describe('createLocalRematch', () => {
  it('keeps players and running scores, redeals secrets, avoids the same footballer', () => {
    const s0 = intoVoting(intoAsking(createLocalGame(NAMES, seq([0.5, 0.1, 0.8]))));
    const done = voteAll(s0, voter =>
      voter === s0.imposterId ? s0.order.find(id => id !== voter)! : s0.imposterId,
    );
    const redeemed = applyLocalRedemption(done, done.footballerId);

    const next = createLocalRematch(redeemed, seq([0.9, 0.2, 0.6]));
    expect(next.players).toEqual(redeemed.players);
    expect(next.scores).toEqual(redeemed.scores);
    expect(next.stage).toBe('roleReveal');
    expect(next.round).toBe(1);
    expect(next.votes).toEqual({});
    expect(next.reveal).toBeUndefined();
    expect(next.footballerId).not.toBe(redeemed.footballerId);
    expect(next.players.some(p => p.id === next.imposterId)).toBe(true);
  });
});
