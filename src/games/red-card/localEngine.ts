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
 */
import {shuffle, type Rng} from '../../data/football';
import {applyRedemption, cleanAnswer, eligibleFootballerIds, tally} from './engine';
import {buildQuestionIds, rememberQuestions} from './questions';
import {MAX_ROUNDS, MIN_POOL, MIN_ROUNDS, SCORE} from './types';

/**
 * Fewest players for a meaningful local hand (1 imposter + 2 detectives).
 * Independent of the online `MIN_PLAYERS` so lobby experiments never loosen
 * pass-and-play.
 */
export const LOCAL_MIN_PLAYERS = 3;

export type LocalPlayer = {id: string; name: string};

export type LocalStage =
  /** The phone goes around once; each player privately sees their role. */
  | 'roleReveal'
  /** Per round: the phone goes around and each player privately types an answer. */
  | 'answering'
  /** Phone in the middle: the round's answers show one by one, attributed. */
  | 'answerReveal'
  /** The phone goes around again; each player secretly taps a vote. */
  | 'voting'
  /** The caught imposter gets the phone for a blind redemption guess. */
  | 'redemption'
  /** Everything on the table: secret, scoreboard, votes. */
  | 'reveal';

export type LocalReveal = {
  caught: boolean;
  /** Points earned this hand (includes a successful redemption). */
  deltas: Record<string, number>;
  /** voterId -> the player they voted for. */
  votes: Record<string, string>;
  redemption?: {guessId: string; correct: boolean};
};

export type LocalRedCardState = {
  players: LocalPlayer[];
  /** The two secrets — safe here because the phone itself is shared. */
  imposterId: string;
  footballerId: string;
  /** Shuffled player order, used for role handoffs, answering, and voting. */
  order: string[];
  /** Host-picked question count, MIN_ROUNDS..MAX_ROUNDS. */
  rounds: number;
  /** Stable question ids, one per round (see `questions.ts`). */
  questionIds: string[];
  /** Every question this session has asked (oldest first), across rematches. */
  usedQuestionIds: string[];
  /** 1..rounds — one shared question per round. */
  round: number;
  /** The current round's answers, playerId -> text. */
  answers: Record<string, string>;
  /** Randomized playerId order for the current round's answer reveal. */
  revealOrder: string[];
  /** Which answer is on screen during answerReveal (0-based). */
  answerIndex: number;
  votes: Record<string, string>;
  /** Running totals across hands. */
  scores: Record<string, number>;
  stage: LocalStage;
  /** Index into `order` of whose eyes may be on the screen (handoff stages). */
  handoffIndex: number;
  /** false = "Pass the phone to X" gate; true = X's private content is up. */
  contentShown: boolean;
  reveal?: LocalReveal;
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
  const players = trimmed.map((name, i) => ({id: `p${i + 1}`, name}));
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.id] = 0;
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
  players: LocalPlayer[],
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
    players,
    imposterId: players[Math.floor(rng() * players.length)].id,
    footballerId: candidates[Math.floor(rng() * candidates.length)],
    order: shuffle(players.map(p => p.id), rng),
    rounds,
    questionIds,
    usedQuestionIds: rememberQuestions(usedQuestionIds, questionIds),
    round: 1,
    answers: {},
    revealOrder: [],
    answerIndex: 0,
    votes: {},
    scores,
    stage: 'roleReveal',
    handoffIndex: 0,
    contentShown: false,
  };
}

/** The player the phone is being passed to (roles / answering / voting / redemption). */
export function handoffPlayer(state: LocalRedCardState): LocalPlayer | undefined {
  if (state.stage === 'redemption') {
    return state.players.find(p => p.id === state.imposterId);
  }
  const id = state.order[state.handoffIndex];
  return state.players.find(p => p.id === id);
}

/** The handoff player taps: their private content comes up. */
export function showContent(state: LocalRedCardState): LocalRedCardState {
  if (state.contentShown) {
    return state;
  }
  return {...state, contentShown: true};
}

/**
 * "Hide and pass on" after a private role look. The last look starts the first
 * question round. (Answering and voting advance through their own private
 * actions instead — submitting IS the pass.)
 */
export function hideAndPass(state: LocalRedCardState): LocalRedCardState {
  if (state.stage !== 'roleReveal' || !state.contentShown) {
    return state;
  }
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {...state, handoffIndex: next, contentShown: false};
  }
  return {...state, stage: 'answering', handoffIndex: 0, contentShown: false};
}

/**
 * The gated player privately types their answer to the round's question.
 * Recording it re-arms the pass gate for the next player; the last answer
 * shuffles a reveal order and puts the phone in the middle for the one-by-one
 * reveal. Empty or over-long answers are ignored (the screen disables submit).
 */
export function submitLocalAnswer(
  state: LocalRedCardState,
  text: string,
  rng: Rng = Math.random,
): LocalRedCardState {
  if (state.stage !== 'answering' || !state.contentShown) {
    return state;
  }
  const clean = cleanAnswer(text);
  if (!clean) {
    return state;
  }
  const playerId = state.order[state.handoffIndex];
  const answers = {...state.answers, [playerId]: clean};
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {...state, answers, handoffIndex: next, contentShown: false};
  }
  return {
    ...state,
    answers,
    stage: 'answerReveal',
    revealOrder: shuffle([...state.order], rng),
    answerIndex: 0,
    handoffIndex: 0,
    contentShown: false,
  };
}

/**
 * Anyone taps past the answer on the table: next answer, then either the next
 * round's question (fresh answers, phone goes around again) or — after the
 * final round — the vote.
 */
export function advanceLocalAnswerReveal(
  state: LocalRedCardState,
): LocalRedCardState {
  if (state.stage !== 'answerReveal') {
    return state;
  }
  if (state.answerIndex + 1 < state.revealOrder.length) {
    return {...state, answerIndex: state.answerIndex + 1};
  }
  if (state.round < state.rounds) {
    return {
      ...state,
      stage: 'answering',
      round: state.round + 1,
      answers: {},
      revealOrder: [],
      answerIndex: 0,
      handoffIndex: 0,
      contentShown: false,
    };
  }
  return {...state, stage: 'voting', handoffIndex: 0, contentShown: false};
}

/**
 * The handoff player secretly votes. Rejects self-votes. Recording the vote
 * immediately re-arms the pass gate for the next voter; the last vote scores
 * the hand with the shared `tally` and moves to redemption (imposter caught)
 * or straight to the reveal (imposter escaped).
 */
export function castLocalVote(
  state: LocalRedCardState,
  targetId: string,
): LocalRedCardState {
  if (state.stage !== 'voting' || !state.contentShown) {
    return state;
  }
  const voterId = state.order[state.handoffIndex];
  if (voterId === targetId || !state.players.some(p => p.id === targetId)) {
    return state;
  }
  const votes = {...state.votes, [voterId]: targetId};
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {...state, votes, handoffIndex: next, contentShown: false};
  }
  const result = tally(
    votes,
    state.imposterId,
    state.players.map(p => p.id),
    state.scores,
  );
  return {
    ...state,
    votes,
    scores: result.scores,
    reveal: {caught: result.caught, deltas: result.deltas, votes},
    stage: result.caught ? 'redemption' : 'reveal',
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
  if (state.stage !== 'redemption' || !state.reveal) {
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
    stage: 'reveal',
    contentShown: false,
  };
}

/** Players sorted by running score (desc), for the reveal scoreboard. */
export function localStandings(
  state: LocalRedCardState,
): {id: string; name: string; score: number}[] {
  return state.players
    .map(p => ({id: p.id, name: p.name, score: state.scores[p.id] ?? 0}))
    .sort((a, b) => b.score - a.score);
}

export function localNameOf(state: LocalRedCardState, id: string): string {
  return state.players.find(p => p.id === id)?.name ?? '';
}
