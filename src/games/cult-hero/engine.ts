/**
 * Cult Hero game logic — pure functions over `CultHeroState`.
 *
 * Authority split: answer collection, validity and rarity scoring happen
 * SERVER-SIDE (see the 0018 migration) because they touch hidden picks and the
 * global stats. The client drives the one public, turn-gated phase
 * (roundReveal) — the host pages through the scored results by computing the
 * next state and shipping it via `play_move`, exactly like Red Card's answer
 * reveal — plus a `computeScores` mirror of the server formula for tests and
 * display math.
 */
import type {EligibleEntry} from './famePrior';
import type {CultHeroResult, CultHeroState} from './types';

/**
 * Mirror of the authoritative scoring in the 0018 migration: weight = shipped
 * pseudo-count + global picks; a valid answer scores its obscurity percentile
 * (strictly-heavier count over n−1), an invalid one scores 0. Results come
 * back in answer order — the server owns the reveal ordering.
 */
export function computeScores(
  eligible: readonly EligibleEntry[],
  picks: Record<string, number>,
  answers: readonly {userId: string; footballerId: string}[],
): CultHeroResult[] {
  const weights = new Map(eligible.map(e => [e.id, e.w + (picks[e.id] ?? 0)]));
  const n = eligible.length;
  return answers.map(a => {
    const w = weights.get(a.footballerId);
    if (w === undefined) {
      return {userId: a.userId, footballerId: a.footballerId, valid: false, score: 0};
    }
    let heavier = 0;
    for (const other of weights.values()) {
      if (other > w) {
        heavier++;
      }
    }
    return {
      userId: a.userId,
      footballerId: a.footballerId,
      valid: true,
      score: Math.round((100 * heavier) / Math.max(n - 1, 1)),
    };
  });
}

/**
 * The host pages the game forward: next result, then the round's leaderboard
 * (Kahoot-style standings between questions), then the next question — or,
 * after the final round, straight into the final standings (which already ARE
 * the leaderboard, so it never shows twice). Ships via `play_move`; the server
 * handed the host the turn when the round resolved, the host keeps it through
 * the leaderboard, and moving into the next question returns it to null so
 * the state locks again. `results` stay through 'leaderboard' and 'final' so
 * the round's deltas can show.
 *
 * Pass-and-play reuses this pager on a wider state (`localEngine.ts`), which
 * relies on every branch spreading `state` — keep it spread-preserving.
 */
export function advanceRoundReveal(state: CultHeroState): CultHeroState {
  if (state.phase === 'leaderboard') {
    if (state.round < state.rounds) {
      const rest = {...state};
      delete rest.results;
      return {
        ...rest,
        phase: 'answering',
        round: state.round + 1,
        answeredCount: 0,
        revealIndex: 0,
        turnUserId: null,
      };
    }
    return {...state, phase: 'final', turnUserId: null};
  }
  if (state.phase !== 'roundReveal' || !state.results) {
    return state;
  }
  if (state.revealIndex + 1 < state.results.length) {
    return {...state, revealIndex: state.revealIndex + 1};
  }
  if (state.round < state.rounds) {
    return {...state, phase: 'leaderboard'};
  }
  return {...state, phase: 'final', turnUserId: null};
}

/** Players sorted by running score (desc), for the standings. */
export function standings(
  state: CultHeroState,
): {userId: string; name: string; score: number}[] {
  return state.players
    .map(p => ({userId: p.userId, name: p.name, score: state.scores[p.userId] ?? 0}))
    .sort((a, b) => b.score - a.score);
}

/** Display name for a user id; empty string for a player no longer present. */
export function nameOf(state: CultHeroState, userId: string): string {
  return state.players.find(p => p.userId === userId)?.name ?? '';
}

/**
 * This round's points per player, for the standings' +N column. `results` stay
 * through 'leaderboard' and 'final', so the last round's scores double as the
 * final deltas.
 */
export function deltasOf(state: CultHeroState): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const result of state.results ?? []) {
    deltas[result.userId] = result.score;
  }
  return deltas;
}
