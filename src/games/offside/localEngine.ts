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
import type {OffsidePlayer, OffsideState} from './types';

/** An odd-one-out race works head-to-head, same floor as online. */
export const LOCAL_MIN_PLAYERS = 2;

/**
 * `LocalOffsideState` extends the online `OffsideState`, so the shared
 * `standings`/`deltasOf` and the online components' props work unchanged, and
 * one GameView draws both modes. The extras are what a shared phone adds.
 *
 * `userId` is a local 'p1'.. id. `roundEndsAt`/`turnUserId` stay null — the
 * server clock and the turn lock have no local meaning; `deadline` is the
 * local answer to the former.
 */
export type LocalOffsideState = OffsideState & {
  /** Shuffled once at deal; the per-round answering order. */
  order: string[];
  /** Index into `order` of whose turn it is (question phase only). */
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
    gameType: 'offside',
    phase: 'question',
    round: 1,
    // Defensive cap: `buildRounds` can return a thinner deck than asked for.
    rounds: deck.length,
    deck,
    roundEndsAt: null,
    turnUserId: null,
    players,
    answers: {},
    answeredCount: 0,
    scores,
    order: shuffle(players.map(p => p.userId), rng),
    handoffIndex: 0,
    contentShown: false,
    deadline: null,
  };
}

/** The player the phone is being passed to (question phase only). */
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
  if (state.phase !== 'question' || state.contentShown) {
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
    state.phase !== 'question' ||
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
      answeredCount: state.answeredCount + 1,
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
    answeredCount: state.answeredCount + 1,
    scores,
    phase: 'reveal',
    handoffIndex: 0,
    contentShown: false,
    deadline: null,
  };
}

/** Anyone taps the game forward: reveal → scoreboard → next question (fresh
 * answers, gate re-armed) or, after the last round, the final standings. */
export function advanceLocalOffside(state: LocalOffsideState): LocalOffsideState {
  if (state.phase === 'reveal') {
    return {...state, phase: 'scoreboard'};
  }
  if (state.phase !== 'scoreboard') {
    return state;
  }
  if (state.round < state.rounds) {
    return {
      ...state,
      phase: 'question',
      round: state.round + 1,
      answers: {},
      answeredCount: 0,
      handoffIndex: 0,
      contentShown: false,
      deadline: null,
    };
  }
  return {...state, phase: 'standings'};
}
