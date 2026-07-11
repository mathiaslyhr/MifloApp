import {
  advanceLocalReveal,
  createLocalCultHeroGame,
  createLocalCultHeroRematch,
  handoffPlayer,
  LOCAL_MIN_PLAYERS,
  showPick,
  submitLocalPick,
} from '../localEngine';
import {computeScores} from '../engine';
import {MIN_ELIGIBLE} from '../types';
import type {LocalCultHeroState} from '../localEngine';

/** Deterministic rng: cycles a fixed sequence of [0,1) values. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const NAMES = ['Ana', 'Ben'];

/** Everyone picks this round; `pick` maps a playerId to a footballer id. */
function playRound(
  state: LocalCultHeroState,
  pick: (playerId: string, s: LocalCultHeroState) => string,
): LocalCultHeroState {
  let s = state;
  for (let i = 0; i < s.players.length; i++) {
    s = showPick(s);
    s = submitLocalPick(s, pick(s.players[s.handoffIndex].userId, s), seq([0.5]));
  }
  return s;
}

describe('createLocalCultHeroGame', () => {
  it('is deterministic for a seeded rng', () => {
    const a = createLocalCultHeroGame(NAMES, 3, seq([0.1, 0.5, 0.9, 0.3]));
    const b = createLocalCultHeroGame(NAMES, 3, seq([0.1, 0.5, 0.9, 0.3]));
    expect(a).toEqual(b);
  });

  it('deals distinct prompts with aligned eligible sets', () => {
    const s = createLocalCultHeroGame(NAMES, 4, seq([0.7, 0.2, 0.4]));
    expect(s.rounds).toBe(s.promptKeys.length);
    expect(new Set(s.promptKeys).size).toBe(s.promptKeys.length);
    expect(s.payloads.map(p => p.key)).toEqual(s.promptKeys);
    for (const payload of s.payloads) {
      expect(payload.eligible.length).toBeGreaterThanOrEqual(MIN_ELIGIBLE);
    }
    expect(s.phase).toBe('answering');
    expect(s.round).toBe(1);
    expect(s.contentShown).toBe(false);
    expect(s.turnUserId).toBeNull();
    expect(Object.values(s.scores)).toEqual([0, 0]);
  });

  it('trims names and rejects fewer than the minimum', () => {
    expect(() => createLocalCultHeroGame(['A', '   '], 3)).toThrow();
    expect(LOCAL_MIN_PLAYERS).toBe(2);
    const s = createLocalCultHeroGame(['  Ana ', 'Ben '], 3);
    expect(s.players.map(p => p.name)).toEqual(['Ana', 'Ben']);
  });

  it('rejects a round count outside 3 to 8', () => {
    expect(() => createLocalCultHeroGame(NAMES, 2)).toThrow();
    expect(() => createLocalCultHeroGame(NAMES, 9)).toThrow();
    expect(createLocalCultHeroGame(NAMES, 8).rounds).toBe(8);
  });
});

describe('submitLocalPick', () => {
  it('is a no-op behind the pass gate', () => {
    const gated = createLocalCultHeroGame(NAMES, 3, seq([0.5]));
    expect(submitLocalPick(gated, 'anyone')).toBe(gated);
  });

  it('records each pick behind the gate and re-arms it for the next player', () => {
    let s = createLocalCultHeroGame(NAMES, 3, seq([0.5]));
    const first = s.players[0];
    expect(handoffPlayer(s)).toBe(first);
    const eligible = s.payloads[0].eligible;
    s = submitLocalPick(showPick(s), eligible[0].id);
    expect(s.picks[first.userId]).toBe(eligible[0].id);
    expect(s.phase).toBe('answering');
    expect(s.handoffIndex).toBe(1);
    expect(s.answeredCount).toBe(1);
    expect(s.contentShown).toBe(false);
  });

  it('the last pick scores fame-prior-only and opens the reveal rarest-last', () => {
    let s = createLocalCultHeroGame(NAMES, 3, seq([0.5]));
    const eligible = s.payloads[0].eligible;
    const heaviest = [...eligible].sort((a, b) => b.w - a.w)[0];
    const lightest = [...eligible].sort((a, b) => a.w - b.w)[0];
    const picked: Record<string, string> = {
      [s.players[0].userId]: heaviest.id,
      [s.players[1].userId]: lightest.id,
    };
    s = playRound(s, id => picked[id]);

    expect(s.phase).toBe('roundReveal');
    expect(s.revealIndex).toBe(0);
    // Exact equivalence with the shared scorer over an EMPTY global-picks map.
    const expected = computeScores(
      eligible,
      {},
      s.players.map(p => ({userId: p.userId, footballerId: picked[p.userId]})),
    );
    for (const r of s.results!) {
      const mirror = expected.find(e => e.userId === r.userId)!;
      expect(r).toEqual(mirror);
      expect(s.scores[r.userId]).toBe(mirror.score);
    }
    // Most-picked (heaviest, lowest score) first, rarest last.
    const scores = s.results!.map(r => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(s.results![s.results!.length - 1].userId).toBe(s.players[1].userId);
  });

  it('an ineligible pick is invalid and worth 0', () => {
    let s = createLocalCultHeroGame(NAMES, 3, seq([0.5]));
    const eligible = s.payloads[0].eligible;
    const invalidId = 'Nobody, Real';
    s = playRound(s, (id, cur) =>
      id === cur.players[0].userId ? invalidId : eligible[0].id,
    );
    const invalid = s.results!.find(r => r.userId === s.players[0].userId)!;
    expect(invalid).toMatchObject({valid: false, score: 0});
    expect(s.scores[s.players[0].userId]).toBe(0);
  });
});

describe('advanceLocalReveal', () => {
  it('pages every result, shows the leaderboard, then re-arms the next round', () => {
    let s = createLocalCultHeroGame(NAMES, 3, seq([0.5]));
    const eligible = s.payloads[0].eligible;
    s = playRound(s, () => eligible[0].id);

    // Page the two results one by one.
    expect(s.revealIndex).toBe(0);
    s = advanceLocalReveal(s);
    expect(s.phase).toBe('roundReveal');
    expect(s.revealIndex).toBe(1);
    s = advanceLocalReveal(s);
    expect(s.phase).toBe('leaderboard');
    expect(s.results).toBeDefined();

    s = advanceLocalReveal(s);
    expect(s.phase).toBe('answering');
    expect(s.round).toBe(2);
    expect(s.results).toBeUndefined();
    expect(s.picks).toEqual({});
    expect(s.answeredCount).toBe(0);
    expect(s.handoffIndex).toBe(0);
    expect(s.contentShown).toBe(false);
  });

  it('goes straight to the final after the last round, extras intact', () => {
    let s = createLocalCultHeroGame(NAMES, 3, seq([0.5]));
    while (s.phase !== 'final') {
      if (s.phase === 'answering') {
        const eligible = s.payloads[s.round - 1].eligible;
        s = playRound(s, () => eligible[0].id);
      } else {
        s = advanceLocalReveal(s);
      }
      // The online pager's spreads must carry the local extras through every
      // transition — this pins the `advanceRoundReveal` reuse.
      expect(s.payloads).toHaveLength(s.rounds);
      expect(s.usedPromptKeys.length).toBeGreaterThanOrEqual(s.rounds);
    }
    expect(s.round).toBe(s.rounds);
    expect(s.results).toBeDefined();
  });
});

describe('createLocalCultHeroRematch', () => {
  function finishGame(state: LocalCultHeroState): LocalCultHeroState {
    let s = state;
    while (s.phase !== 'final') {
      s =
        s.phase === 'answering'
          ? playRound(s, () => s.payloads[s.round - 1].eligible[0].id)
          : advanceLocalReveal(s);
    }
    return s;
  }

  it('carries the running scores forward and avoids repeated prompts', () => {
    let s = finishGame(createLocalCultHeroGame(NAMES, 3, seq([0.5, 0.1, 0.8])));
    const seen = new Set<string>(s.promptKeys);
    const totals = {...s.scores};

    const next = createLocalCultHeroRematch(s, seq([0.9, 0.2, 0.6]));
    expect(next.players).toEqual(s.players);
    expect(next.scores).toEqual(totals);
    expect(next.phase).toBe('answering');
    expect(next.round).toBe(1);
    expect(next.picks).toEqual({});
    expect(next.results).toBeUndefined();
    for (const key of next.promptKeys) {
      expect(seen.has(key)).toBe(false);
    }
  });

  it('accumulates asked prompts across a few rematches', () => {
    let s = createLocalCultHeroGame(NAMES, 3, seq([0.5, 0.1, 0.8]));
    const seen = new Set<string>(s.promptKeys);
    for (let game = 0; game < 3; game++) {
      s = createLocalCultHeroRematch(s, seq([0.3, 0.6, 0.9]));
      for (const key of s.promptKeys) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      expect(s.usedPromptKeys).toHaveLength(seen.size);
    }
  });
});
