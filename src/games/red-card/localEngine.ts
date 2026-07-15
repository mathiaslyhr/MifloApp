/**
 * Red Card pass-and-play — a pure local state machine for one shared phone.
 *
 * Online, the secrets (imposter, footballer) live server-side so no device can
 * cheat. On a single passed-around phone that threat model doesn't apply: the
 * secrets sit in this in-memory state, and privacy comes from the handoff gate
 * (`contentShown`) — the screen shows "Pass the phone to X" until X taps to
 * reveal their private content, and hides it again before the next pass.
 * Scoring reuses the online mirrors (`tally`, `applyRedemption`) so both modes
 * award identical points.
 *
 * `LocalRedCardState` extends the online `ImposterState`, so the shared
 * `advanceAnswerReveal`, `standings`, `nameOf` and `awaitingRedemption` work
 * unchanged and one GameView draws both modes.
 *
 * THE SECRET RULE. `imposterId`/`footballerId` are extras here and are NOT on
 * `ImposterState`. That is what keeps the GameView honest: its `state` prop is
 * typed `ImposterState`, so reading a secret inside it is a compile error, and
 * the secret can only arrive through `perspective`. This state must therefore
 * never reach the wire — the local container has no `roomId` and must never
 * import `core/rooms/*`.
 */
import {shuffle, type Rng} from '../../data/football';
import {
  advanceAnswerReveal,
  applyRedemption,
  awaitingRedemption,
  cleanAnswer,
  eligibleFootballerIds,
  tally,
} from './engine';
import {buildQuestionIds, rememberQuestions} from './questions';
import {MAX_ROUNDS, MIN_POOL, MIN_ROUNDS, SCORE} from './types';
import type {ImposterPlayer, ImposterRole, ImposterState} from './types';

/**
 * Fewest players for a meaningful local hand (1 imposter + 2 detectives).
 * Independent of the online `MIN_PLAYERS` so lobby experiments never loosen
 * pass-and-play.
 */
export const LOCAL_MIN_PLAYERS = 3;

export type LocalRedCardState = ImposterState & {
  /** The two secrets — safe here because the phone itself is shared. */
  imposterId: string;
  footballerId: string;
  /** Shuffled player order, used for role handoffs, answering, and voting. */
  order: string[];
  /** Index into `order` of whose eyes may be on the screen (handoff steps). */
  handoffIndex: number;
  /** false = "Pass the phone to X" gate; true = X's private content is up. */
  contentShown: boolean;
  /**
   * The role round-trip: the phone goes around once so each player privately
   * sees their role. A local-only step INSIDE the shared `answering` phase —
   * it mirrors the role modal online lays over the same phase.
   */
  roleTrip: boolean;
  /**
   * This round's answers before publication, playerId -> text. The local mirror
   * of the server's private answer table; published into `answers` when the
   * last player submits.
   */
  drafts: Record<string, string>;
  /** Votes so far, voterId -> targetId. Public only via `reveal.votes`. */
  votes: Record<string, string>;
  /** Every question this session has asked (oldest first), across rematches. */
  usedQuestionIds: string[];
};

/** Deal a fresh hand for the named players (3+, trimmed non-empty names). */
export function createLocalGame(
  names: string[],
  rounds: number,
  rng: Rng = Math.random,
): LocalRedCardState {
  const trimmed = names.map(n => n.trim()).filter(n => n.length > 0);
  if (trimmed.length < LOCAL_MIN_PLAYERS) {
    throw new Error(`Red Card needs at least ${LOCAL_MIN_PLAYERS} players`);
  }
  if (rounds < MIN_ROUNDS || rounds > MAX_ROUNDS) {
    throw new Error(`Red Card plays ${MIN_ROUNDS} to ${MAX_ROUNDS} rounds`);
  }
  const players = trimmed.map((name, i) => ({userId: `p${i + 1}`, name}));
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.userId] = 0;
  }
  return dealHand(players, scores, rounds, rng);
}

/** Same players, round count and running scores kept; new secrets + questions. */
export function createLocalRematch(
  state: LocalRedCardState,
  rng: Rng = Math.random,
): LocalRedCardState {
  return dealHand(
    state.players,
    state.scores,
    state.rounds,
    rng,
    state.footballerId,
    state.usedQuestionIds,
  );
}

function dealHand(
  players: ImposterPlayer[],
  scores: Record<string, number>,
  rounds: number,
  rng: Rng,
  avoidFootballerId?: string,
  usedQuestionIds: string[] = [],
): LocalRedCardState {
  const pool = eligibleFootballerIds();
  if (pool.length < MIN_POOL) {
    throw new Error('Not enough illustrated footballers for Red Card');
  }
  // Never repeat the secret straight after a hand — everyone just saw it.
  const candidates = avoidFootballerId
    ? pool.filter(id => id !== avoidFootballerId)
    : pool;
  // Prefer questions the session hasn't heard yet (see questions.ts).
  const questionIds = buildQuestionIds(rounds, rng, usedQuestionIds);
  return {
    gameType: 'red-card',
    // The hand opens on the role round-trip, which lives inside `answering`.
    phase: 'answering',
    round: 1,
    rounds,
    questionIds,
    turnUserId: null,
    players,
    answeredCount: 0,
    answerIndex: 0,
    votedCount: 0,
    scores,
    imposterId: players[Math.floor(rng() * players.length)].userId,
    footballerId: candidates[Math.floor(rng() * candidates.length)],
    order: shuffle(players.map(p => p.userId), rng),
    handoffIndex: 0,
    contentShown: false,
    roleTrip: true,
    drafts: {},
    votes: {},
    usedQuestionIds: rememberQuestions(usedQuestionIds, questionIds),
  };
}

/** The player the phone is being passed to (roles / answering / voting / redemption). */
export function handoffPlayer(
  state: LocalRedCardState,
): ImposterPlayer | undefined {
  if (awaitingRedemption(state)) {
    return state.players.find(p => p.userId === state.imposterId);
  }
  const id = state.order[state.handoffIndex];
  return state.players.find(p => p.userId === id);
}

/**
 * The gated player's private role. Local-only by nature: online this comes off
 * the server, which is the entire reason the secret lives off-device there.
 */
export function localRole(
  state: LocalRedCardState,
  userId: string,
): ImposterRole {
  return userId === state.imposterId
    ? {role: 'imposter'}
    : {role: 'detective', footballerId: state.footballerId};
}

/** The handoff player taps: their private content comes up. */
export function showContent(state: LocalRedCardState): LocalRedCardState {
  if (state.contentShown) {
    return state;
  }
  return {...state, contentShown: true};
}

/**
 * "Hide and pass on" after a private role look. The last look ends the role
 * round-trip and starts the first question. (Answering and voting advance
 * through their own private actions instead — submitting IS the pass.)
 */
export function hideAndPass(state: LocalRedCardState): LocalRedCardState {
  if (!state.roleTrip || !state.contentShown) {
    return state;
  }
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {...state, handoffIndex: next, contentShown: false};
  }
  return {...state, roleTrip: false, handoffIndex: 0, contentShown: false};
}

/**
 * The gated player privately types their answer to the round's question.
 * Recording it re-arms the pass gate for the next player; the last answer
 * publishes the round's texts in a random order — the local mirror of the
 * server writing them into the public state — and puts the phone in the middle
 * for the one-by-one reveal. Empty or over-long answers are ignored (the screen
 * disables submit).
 */
export function submitLocalAnswer(
  state: LocalRedCardState,
  text: string,
  rng: Rng = Math.random,
): LocalRedCardState {
  if (state.phase !== 'answering' || state.roleTrip || !state.contentShown) {
    return state;
  }
  const clean = cleanAnswer(text);
  if (!clean) {
    return state;
  }
  const playerId = state.order[state.handoffIndex];
  const drafts = {...state.drafts, [playerId]: clean};
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {
      ...state,
      drafts,
      answeredCount: state.answeredCount + 1,
      handoffIndex: next,
      contentShown: false,
    };
  }
  return {
    ...state,
    drafts: {},
    answeredCount: state.answeredCount + 1,
    answers: shuffle([...state.order], rng).map(id => ({
      userId: id,
      text: drafts[id],
    })),
    phase: 'answerReveal',
    answerIndex: 0,
    handoffIndex: 0,
    contentShown: false,
  };
}

/**
 * Anyone taps past the answer on the table, reusing the online pager; its
 * spreads preserve the local extras at runtime, the cast just restores the
 * wider type. Rolling into a new round (or the vote) re-arms the pass gate for
 * player one.
 */
export function advanceLocalAnswerReveal(
  state: LocalRedCardState,
): LocalRedCardState {
  const next = advanceAnswerReveal(state) as LocalRedCardState;
  if (next.phase !== state.phase || next.round !== state.round) {
    return {...next, drafts: {}, handoffIndex: 0, contentShown: false};
  }
  return next;
}

/**
 * The handoff player secretly votes. Rejects self-votes. Recording the vote
 * immediately re-arms the pass gate for the next voter; the last vote scores
 * the hand with the shared `tally` and opens the reveal. A caught imposter
 * still owes a blind guess — see `awaitingRedemption`.
 */
export function castLocalVote(
  state: LocalRedCardState,
  targetId: string,
): LocalRedCardState {
  if (state.phase !== 'voting' || !state.contentShown) {
    return state;
  }
  const voterId = state.order[state.handoffIndex];
  if (voterId === targetId || !state.players.some(p => p.userId === targetId)) {
    return state;
  }
  const votes = {...state.votes, [voterId]: targetId};
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {
      ...state,
      votes,
      votedCount: state.votedCount + 1,
      handoffIndex: next,
      contentShown: false,
    };
  }
  const result = tally(
    votes,
    state.imposterId,
    state.players.map(p => p.userId),
    state.scores,
  );
  return {
    ...state,
    votes,
    votedCount: state.votedCount + 1,
    scores: result.scores,
    // The hand is over, so the secrets go public here — exactly as the server
    // writes them into `reveal` online.
    reveal: {
      imposterId: state.imposterId,
      footballerId: state.footballerId,
      caught: result.caught,
      deltas: result.deltas,
      votes,
    },
    phase: 'reveal',
    handoffIndex: 0,
    contentShown: false,
  };
}

/**
 * The caught imposter's blind guess at the secret footballer. A correct guess
 * adds the redemption points (shared `applyRedemption`) to both the running
 * total and this hand's deltas, then everything goes public.
 */
export function applyLocalRedemption(
  state: LocalRedCardState,
  guessId: string,
): LocalRedCardState {
  if (!awaitingRedemption(state) || !state.reveal) {
    return state;
  }
  const correct = guessId === state.footballerId;
  const deltas = correct
    ? {
        ...state.reveal.deltas,
        [state.imposterId]:
          (state.reveal.deltas[state.imposterId] ?? 0) + SCORE.imposterRedeem,
      }
    : state.reveal.deltas;
  return {
    ...state,
    scores: applyRedemption(state.scores, state.imposterId, correct),
    reveal: {...state.reveal, deltas, redemption: {guessId, correct}},
    contentShown: false,
  };
}
