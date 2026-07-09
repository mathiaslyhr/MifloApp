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
import {applyRedemption, eligibleFootballerIds, tally} from './engine';
import {MIN_POOL, ROUNDS, SCORE} from './types';

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
  /** Questions happen out loud; the state only tracks whose turn it is. */
  | 'asking'
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
  /** Shuffled player order, used for role handoffs, asking, and voting. */
  order: string[];
  /** 1..ROUNDS — each player asks once per round. */
  round: number;
  /** Index into `order` of the current asker. */
  turnIndex: number;
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
  rng: Rng = Math.random,
): LocalRedCardState {
  const trimmed = names.map(n => n.trim()).filter(n => n.length > 0);
  if (trimmed.length < LOCAL_MIN_PLAYERS) {
    throw new Error(`Red Card needs at least ${LOCAL_MIN_PLAYERS} players`);
  }
  const players = trimmed.map((name, i) => ({id: `p${i + 1}`, name}));
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.id] = 0;
  }
  return dealHand(players, scores, rng);
}

/** Same players, running scores kept; new imposter, secret, and order. */
export function createLocalRematch(
  state: LocalRedCardState,
  rng: Rng = Math.random,
): LocalRedCardState {
  return dealHand(state.players, state.scores, rng, state.footballerId);
}

function dealHand(
  players: LocalPlayer[],
  scores: Record<string, number>,
  rng: Rng,
  avoidFootballerId?: string,
): LocalRedCardState {
  const pool = eligibleFootballerIds();
  if (pool.length < MIN_POOL) {
    throw new Error('Not enough illustrated footballers for Red Card');
  }
  // Never repeat the secret straight after a hand — everyone just saw it.
  const candidates = avoidFootballerId
    ? pool.filter(id => id !== avoidFootballerId)
    : pool;
  return {
    players,
    imposterId: players[Math.floor(rng() * players.length)].id,
    footballerId: candidates[Math.floor(rng() * candidates.length)],
    order: shuffle(players.map(p => p.id), rng),
    round: 1,
    turnIndex: 0,
    votes: {},
    scores,
    stage: 'roleReveal',
    handoffIndex: 0,
    contentShown: false,
  };
}

/** The player the phone is being passed to (role reveal / voting / redemption). */
export function handoffPlayer(state: LocalRedCardState): LocalPlayer | undefined {
  if (state.stage === 'redemption') {
    return state.players.find(p => p.id === state.imposterId);
  }
  const id = state.order[state.handoffIndex];
  return state.players.find(p => p.id === id);
}

/** The current asker during the out-loud questioning rounds. */
export function currentAsker(state: LocalRedCardState): LocalPlayer | undefined {
  const id = state.order[state.turnIndex];
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
 * "Hide and pass on" after a private role look. The last look starts the
 * asking rounds. (Voting advances through `castLocalVote` instead — a vote IS
 * the private action.)
 */
export function hideAndPass(state: LocalRedCardState): LocalRedCardState {
  if (state.stage !== 'roleReveal' || !state.contentShown) {
    return state;
  }
  const next = state.handoffIndex + 1;
  if (next < state.order.length) {
    return {...state, handoffIndex: next, contentShown: false};
  }
  return {...state, stage: 'asking', handoffIndex: 0, contentShown: false};
}

/**
 * Advance past the current asker. Moves to the next player in order; when the
 * order wraps, either starts the next round or — after the final round — hands
 * the phone around for voting.
 */
export function advanceAskLocal(state: LocalRedCardState): LocalRedCardState {
  if (state.stage !== 'asking') {
    return state;
  }
  const next = state.turnIndex + 1;
  if (next < state.order.length) {
    return {...state, turnIndex: next};
  }
  if (state.round < ROUNDS) {
    return {...state, round: state.round + 1, turnIndex: 0};
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
