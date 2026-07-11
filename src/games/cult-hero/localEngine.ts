/**
 * Cult Hero pass-and-play — a pure local state machine for one shared phone.
 *
 * Online, picks hide in a private server table and rarity folds in the global
 * `cult_hero_stats` counts. On one shared phone neither exists: privacy comes
 * from the handoff gate (`contentShown`), and scoring runs `computeScores`
 * with an EMPTY global-picks map — fame prior only, fully offline BY DESIGN.
 * Local games also never feed the global stats; do not "fix" either of those
 * into a network call, the mode's promise is flight-mode play.
 *
 * `LocalCultHeroState` extends the online `CultHeroState`, so the shared
 * `advanceRoundReveal`, `standings` and `nameOf` (plus the online components'
 * props) work unchanged; its spreads carry the local extras through.
 */
import {shuffle, type Rng} from '../../data/football';
import {advanceRoundReveal, computeScores} from './engine';
import {buildPromptPayloads, type PromptPayload} from './famePrior';
import {buildPromptKeys} from './prompts';
import {MAX_ROUNDS, MIN_ROUNDS} from './types';
import type {CultHeroPlayer, CultHeroState} from './types';

/** Rarity is judged against the fame prior, not the table, so two work. */
export const LOCAL_MIN_PLAYERS = 2;

export type LocalCultHeroState = CultHeroState & {
  /** Index into `players` of whose eyes may be on the screen (answering). */
  handoffIndex: number;
  /** false = "Pass the phone to X" gate; true = X's secret pick UI is up. */
  contentShown: boolean;
  /** This round's secret picks, playerId -> footballerId. */
  picks: Record<string, string>;
  /** Each prompt's eligible players + fame priors, dealt at start. */
  payloads: PromptPayload[];
  /** Every prompt this session has asked (oldest first), across rematches. */
  usedPromptKeys: string[];
};

/** Deal a fresh game for the named players (2+, trimmed non-empty names). */
export function createLocalCultHeroGame(
  names: string[],
  rounds: number,
  rng: Rng = Math.random,
): LocalCultHeroState {
  const trimmed = names.map(n => n.trim()).filter(n => n.length > 0);
  if (trimmed.length < LOCAL_MIN_PLAYERS) {
    throw new Error(`Cult Hero needs at least ${LOCAL_MIN_PLAYERS} players`);
  }
  if (rounds < MIN_ROUNDS || rounds > MAX_ROUNDS) {
    throw new Error(`Cult Hero plays ${MIN_ROUNDS} to ${MAX_ROUNDS} rounds`);
  }
  const players = trimmed.map((name, i) => ({userId: `p${i + 1}`, name}));
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.userId] = 0;
  }
  return dealGame(players, scores, rounds, rng, []);
}

/** Same players and round count, fresh prompts avoiding the session's history;
 * running scores CARRY FORWARD — mirrors the online `restart_cult_hero_game`. */
export function createLocalCultHeroRematch(
  state: LocalCultHeroState,
  rng: Rng = Math.random,
): LocalCultHeroState {
  return dealGame(
    state.players,
    state.scores,
    state.rounds,
    rng,
    state.usedPromptKeys,
  );
}

function dealGame(
  players: CultHeroPlayer[],
  scores: Record<string, number>,
  rounds: number,
  rng: Rng,
  used: string[],
): LocalCultHeroState {
  // Prefer prompts the session hasn't heard yet (see prompts.ts).
  const promptKeys = buildPromptKeys(rounds, rng, used);
  if (promptKeys.length === 0) {
    throw new Error('Not enough prompts for a Cult Hero game');
  }
  return {
    gameType: 'cult-hero',
    phase: 'answering',
    round: 1,
    // Defensive cap, same spirit as Offside: a thin pool makes a shorter game.
    rounds: promptKeys.length,
    promptKeys,
    turnUserId: null,
    players,
    answeredCount: 0,
    revealIndex: 0,
    scores,
    handoffIndex: 0,
    contentShown: false,
    picks: {},
    payloads: buildPromptPayloads(promptKeys),
    usedPromptKeys: [...used.filter(k => !promptKeys.includes(k)), ...promptKeys],
  };
}

/** The player the phone is being passed to (answering only). */
export function handoffPlayer(
  state: LocalCultHeroState,
): CultHeroPlayer | undefined {
  return state.players[state.handoffIndex];
}

/** The gated player taps: their secret pick UI comes up. */
export function showPick(state: LocalCultHeroState): LocalCultHeroState {
  if (state.phase !== 'answering' || state.contentShown) {
    return state;
  }
  return {...state, contentShown: true};
}

/**
 * Records the current player's secret pick. Submitting IS the pass: the next
 * gate comes up, and the last pick scores the round — fame prior only, empty
 * global-picks map — and opens the reveal, results most-picked first with a
 * random tiebreak (mirrors the server's `order by score asc, random()`).
 */
export function submitLocalPick(
  state: LocalCultHeroState,
  footballerId: string,
  rng: Rng = Math.random,
): LocalCultHeroState {
  if (state.phase !== 'answering' || !state.contentShown) {
    return state;
  }
  const playerId = state.players[state.handoffIndex].userId;
  const picks = {...state.picks, [playerId]: footballerId};
  const next = state.handoffIndex + 1;
  if (next < state.players.length) {
    return {
      ...state,
      picks,
      answeredCount: state.answeredCount + 1,
      handoffIndex: next,
      contentShown: false,
    };
  }
  const eligible = state.payloads[state.round - 1]?.eligible ?? [];
  const answers = state.players.map(p => ({
    userId: p.userId,
    footballerId: picks[p.userId],
  }));
  const results = shuffle(computeScores(eligible, {}, answers), rng).sort(
    (a, b) => a.score - b.score,
  );
  const scores = {...state.scores};
  for (const r of results) {
    scores[r.userId] = (scores[r.userId] ?? 0) + r.score;
  }
  return {
    ...state,
    picks,
    answeredCount: state.answeredCount + 1,
    results,
    scores,
    phase: 'roundReveal',
    revealIndex: 0,
    handoffIndex: 0,
    contentShown: false,
  };
}

/**
 * Anyone pages the open reveal forward, reusing the online pager; its spreads
 * preserve the local extras at runtime, the cast just restores the wider type.
 * Rolling into a new answering round re-arms the pass gate for player one.
 */
export function advanceLocalReveal(
  state: LocalCultHeroState,
): LocalCultHeroState {
  const next = advanceRoundReveal(state) as LocalCultHeroState;
  if (next.phase === 'answering' && state.phase !== 'answering') {
    return {
      ...next,
      picks: {},
      handoffIndex: 0,
      contentShown: false,
      answeredCount: 0,
    };
  }
  return next;
}
