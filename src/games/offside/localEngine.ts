/**
 * Offside pass-and-play — a pure local state machine for one shared phone.
 *
 * Online, everyone races the same 20 second deadline at once. On one phone the
 * race runs in turns: the handoff gate ("Pass the phone to X") hides the cards,
 * and each player's personal clock only starts the moment THEY reveal them.
 * Scoring reuses the online maths (`scoreAnswer` over the fraction of the
 * window left), so a turn is worth exactly what it would be online. Time is
 * injected (`now`) so every transition stays pure and testable.
 */
import {shuffle, type Rng} from '../../data/football';
import {buildRounds} from './questions';
import {fractionRemaining, scoreAnswer} from './scoring';
import {MAX_ROUNDS, MIN_ROUNDS, QUESTION_DURATION_MS} from './types';
import type {OffsideAnswer, OffsidePlayer, OffsideRound} from './types';

/** An odd-one-out race works head-to-head, same floor as online. */
export const LOCAL_MIN_PLAYERS = 2;

export type LocalOffsideStage = 'question' | 'reveal' | 'scoreboard' | 'standings';

export type LocalOffsideState = {
  /** `userId` is a local 'p1'.. id, so the shared engine helpers and the
   * Scoreboard rows work unchanged. */
  players: OffsidePlayer[];
  /** Shuffled once at deal; the per-round answering order. */
  order: string[];
  /** deck.length — `buildRounds` can cap a thin pool to fewer rounds. */
  rounds: number;
  deck: OffsideRound[];
  /** 1..rounds — one deck entry per round. */
  round: number;
  /** This round's answers by playerId; cleared when the next round starts. */
  answers: Record<string, OffsideAnswer>;
  /** Running totals, accumulated when a round resolves. */
  scores: Record<string, number>;
  stage: LocalOffsideStage;
  /** Index into `order` of whose turn it is (question stage only). */
  handoffIndex: number;
  /** false = "Pass the phone to X" gate; true = X's cards and clock are up. */
  contentShown: boolean;
  /** Epoch ms; set the moment X reveals the cards, null otherwise. */
  deadline: number | null;
};

/** Deal a fresh game for the named players (2+, trimmed non-empty names). */
export function createLocalOffsideGame(
  names: string[],
  rounds: number,
  rng: Rng = Math.random,
): LocalOffsideState {
  const trimmed = names.map(n => n.trim()).filter(n => n.length > 0);
  if (trimmed.length < LOCAL_MIN_PLAYERS) {
    throw new Error(`Offside needs at least ${LOCAL_MIN_PLAYERS} players`);
  }
  if (rounds < MIN_ROUNDS || rounds > MAX_ROUNDS) {
    throw new Error(`Offside plays ${MIN_ROUNDS} to ${MAX_ROUNDS} rounds`);
  }
  const players = trimmed.map((name, i) => ({userId: `p${i + 1}`, name}));
  return dealGame(players, rounds, rng);
}

/** Same players and round count, fresh deck, scores back to zero — mirrors the
 * online `restart_offside_game`. */
export function createLocalOffsideRematch(
  state: LocalOffsideState,
  rng: Rng = Math.random,
): LocalOffsideState {
  return dealGame(state.players, state.rounds, rng);
}

function dealGame(
  players: OffsidePlayer[],
  rounds: number,
  rng: Rng,
): LocalOffsideState {
  const deck = buildRounds(rounds, {rng});
  if (deck.length === 0) {
    throw new Error('Not enough footballers for an Offside deck');
  }
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.userId] = 0;
  }
  return {
    players,
    order: shuffle(players.map(p => p.userId), rng),
    rounds: deck.length,
    deck,
    round: 1,
    answers: {},
    scores,
    stage: 'question',
    handoffIndex: 0,
    contentShown: false,
    deadline: null,
  };
}

/** The player the phone is being passed to (question stage only). */
export function handoffPlayer(
  state: LocalOffsideState,
): OffsidePlayer | undefined {
  const id = state.order[state.handoffIndex];
  return state.players.find(p => p.userId === id);
}

/** The gated player taps: the cards come up and THEIR personal clock starts
 * now — never at the pass gate. */
export function revealQuestion(
  state: LocalOffsideState,
  now: number = Date.now(),
): LocalOffsideState {
  if (state.stage !== 'question' || state.contentShown) {
    return state;
  }
  return {...state, contentShown: true, deadline: now + QUESTION_DURATION_MS};
}

/**
 * Records the current player's tap — or `null` when their clock ran out — with
 * the exact online scoring. Submitting IS the pass: the next gate comes up, and
 * the last answer resolves the round (scores accumulate) into the open reveal.
 * A second submit for the same turn is a no-op, which makes the tap-vs-timeout
 * race safe whichever fires first.
 */
export function submitLocalAnswer(
  state: LocalOffsideState,
  option: number | null,
  now: number = Date.now(),
): LocalOffsideState {
  if (
    state.stage !== 'question' ||
    !state.contentShown ||
    state.deadline === null
  ) {
    return state;
  }
  const playerId = state.order[state.handoffIndex];
  if (state.answers[playerId] !== undefined) {
    return state;
  }
  const current = state.deck[state.round - 1];
  const points =
    option === null
      ? 0
      : scoreAnswer(
          option === current.outlierIndex,
          fractionRemaining(state.deadline, now),
        );
  const answers = {...state.answers, [playerId]: {option, points}};
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {
      ...state,
      answers,
      handoffIndex: next,
      contentShown: false,
      deadline: null,
    };
  }
  const scores = {...state.scores};
  for (const [id, answer] of Object.entries(answers)) {
    scores[id] = (scores[id] ?? 0) + answer.points;
  }
  return {
    ...state,
    answers,
    scores,
    stage: 'reveal',
    handoffIndex: 0,
    contentShown: false,
    deadline: null,
  };
}

/** Anyone taps the game forward: reveal → scoreboard → next question (fresh
 * answers, gate re-armed) or, after the last round, the final standings. */
export function advanceLocalOffside(state: LocalOffsideState): LocalOffsideState {
  if (state.stage === 'reveal') {
    return {...state, stage: 'scoreboard'};
  }
  if (state.stage !== 'scoreboard') {
    return state;
  }
  if (state.round < state.rounds) {
    return {
      ...state,
      stage: 'question',
      round: state.round + 1,
      answers: {},
      handoffIndex: 0,
      contentShown: false,
      deadline: null,
    };
  }
  return {...state, stage: 'standings'};
}
