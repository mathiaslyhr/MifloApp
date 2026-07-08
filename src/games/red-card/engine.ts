/**
 * Red Card game logic — pure functions over `ImposterState`.
 *
 * Authority split: role assignment, vote tallying and scoring are done
 * SERVER-SIDE (see the 0015 migration) because they touch secrets. The client
 * helpers here drive the one public, turn-gated phase (asking) — the active
 * asker computes the next state and ships it via `play_move`, exactly like
 * Tic-Tac-Toe — plus a `tally` mirror used for tests and the reveal display.
 */
import {getById, shuffle, type Rng} from '../../data/football';
import {PLAYER_AVATARS} from '../hattrick/assets/playerAvatars';
import {ROUNDS, SCORE} from './types';
import type {ImposterReveal, ImposterState} from './types';

/**
 * Footballers eligible to be the secret: only those we have an illustration for,
 * so the reveal always shows a real portrait. This set grows automatically as
 * more avatars are enabled in `hattrick/assets/playerAvatars.ts`.
 */
export function eligibleFootballerIds(): string[] {
  return Object.keys(PLAYER_AVATARS).filter(id => getById(id) !== undefined);
}

/**
 * The candidate footballer ids the host ships to the server, which privately
 * picks the secret one (so the host never learns it). It's the full eligible
 * set, shuffled — the server rejects a pool smaller than `MIN_POOL`.
 */
export function buildFootballerPool(rng: Rng = Math.random): string[] {
  return shuffle(eligibleFootballerIds(), rng);
}

/** The current asker chooses who to question — everyone's screen then shows it. */
export function setAskTarget(
  state: ImposterState,
  targetUserId: string,
): ImposterState {
  return {...state, askTargetUserId: targetUserId};
}

/**
 * Advance past the current asker. Moves to the next player in order; when the
 * order wraps, either starts the next round or — after the final round — moves
 * the hand into voting. Clears the ask target each step.
 */
export function advanceAsk(state: ImposterState): ImposterState {
  if (state.phase !== 'asking') {
    return state;
  }
  const i = state.order.indexOf(state.turnUserId);
  const next = i + 1;
  if (next < state.order.length) {
    return {...state, turnUserId: state.order[next], askTargetUserId: null};
  }
  // Wrapped past the last asker.
  if (state.round < ROUNDS) {
    return {
      ...state,
      round: state.round + 1,
      turnUserId: state.order[0],
      askTargetUserId: null,
    };
  }
  return {...state, phase: 'voting', askTargetUserId: null};
}

export type TallyResult = {
  caught: boolean;
  deltas: Record<string, number>;
  scores: Record<string, number>;
};

/**
 * Score a hand from its votes. Mirrors the authoritative server logic so tests
 * and the reveal screen agree with the DB:
 *   - each detective who voted for the real imposter: +detectiveCorrect
 *   - `caught` = the imposter is among the most-voted (ties at the top count)
 *   - imposter: +imposterEscape if NOT caught, else 0 (redemption is separate)
 */
export function tally(
  votes: Record<string, string>,
  imposterId: string,
  playerIds: string[],
  prevScores: Record<string, number>,
): TallyResult {
  const counts: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const max = Object.values(counts).reduce((m, c) => Math.max(m, c), 0);
  const caught = max > 0 && (counts[imposterId] ?? 0) === max;

  const deltas: Record<string, number> = {};
  for (const id of playerIds) {
    if (id === imposterId) {
      deltas[id] = caught ? 0 : SCORE.imposterEscape;
    } else {
      deltas[id] = votes[id] === imposterId ? SCORE.detectiveCorrect : 0;
    }
  }

  const scores: Record<string, number> = {};
  for (const id of playerIds) {
    scores[id] = (prevScores[id] ?? 0) + (deltas[id] ?? 0);
  }
  return {caught, deltas, scores};
}

/**
 * Apply a caught imposter's redemption guess to their running total (display
 * mirror of the server). A correct guess adds `imposterRedeem` points.
 */
export function applyRedemption(
  scores: Record<string, number>,
  imposterId: string,
  correct: boolean,
): Record<string, number> {
  if (!correct) {
    return scores;
  }
  return {
    ...scores,
    [imposterId]: (scores[imposterId] ?? 0) + SCORE.imposterRedeem,
  };
}

/** Players sorted by running score (desc), for the reveal scoreboard. */
export function standings(state: ImposterState): {userId: string; name: string; score: number}[] {
  return state.players
    .map(p => ({userId: p.userId, name: p.name, score: state.scores[p.userId] ?? 0}))
    .sort((a, b) => b.score - a.score);
}

/** Convenience readers used by the reveal screen. */
export function nameOf(state: ImposterState, userId: string): string {
  return state.players.find(p => p.userId === userId)?.name ?? '';
}

export function revealSummary(reveal: ImposterReveal, state: ImposterState) {
  return {
    imposterName: nameOf(state, reveal.imposterId),
    caught: reveal.caught,
  };
}
