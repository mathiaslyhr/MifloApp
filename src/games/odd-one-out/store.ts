/**
 * Odd One Out game state. Mirrors the quiz store's phase machine
 * (question → reveal → standings) and reuses the same pure scoring/ranking, so
 * solo and networked play behave identically across games. The only difference
 * is the answer: an option index into the round's four cards, correct when it
 * equals the round's `outlierIndex`.
 */
import {create} from 'zustand';
import type {RoomPlayer} from '../../core/rooms/types';
import {
  rankContestants,
  ranksById,
  scoreAnswer,
  type Contestant,
} from '../quiz/scoring';
import {buildRounds} from './questions';
import type {OddRound} from './mockData';

/** Which part of a round's lifecycle we're in. Drives the round screen. */
export type Phase = 'question' | 'reveal' | 'standings';

/** Map room players to contestants, flagging which one is the local player. */
export function contestantsFromPlayers(
  players: readonly RoomPlayer[],
  myUserId: string | null,
): Contestant[] {
  return players.map(p => ({
    id: p.userId,
    name: p.name,
    score: p.score,
    isYou: p.userId === myUserId,
  }));
}

type OddStore = {
  count: number;
  round: number;

  rounds: OddRound[];
  index: number;
  phase: Phase;
  selected: number | null;
  answered: boolean;
  pendingPoints: number;
  lastPoints: number;

  contestants: Contestant[];
  you: Contestant;
  prevRankById: Record<string, number>;

  /** Start a local/solo game: generate a deck with just you as contestant. */
  start: (count: number, playerName: string) => void;
  /** Start a networked game from a room's shared deck + real players. */
  hydrate: (rounds: OddRound[], contestants: Contestant[]) => void;
  /** Merge live scores from the room; keeps your own (local) score intact. */
  syncContestants: (incoming: Contestant[]) => void;
  /** Lock in an answer during the question phase (no score change yet). */
  lockAnswer: (optionIndex: number | null, fractionRemaining: number) => void;
  /** Close the round: apply your points and show the result. */
  reveal: () => void;
  showStandings: () => void;
  next: () => void;
  playAgain: () => void;
};

const SOLO_YOU: Contestant = {id: 'you', name: 'You', score: 0, isYou: true};

/** Reset fields shared by every fresh-deck entry point. */
const FRESH_ROUND = {
  index: 0,
  phase: 'question' as Phase,
  selected: null,
  answered: false,
  pendingPoints: 0,
  lastPoints: 0,
  prevRankById: {} as Record<string, number>,
};

export const useOddStore = create<OddStore>(set => ({
  count: 0,
  round: 1,

  rounds: [],
  ...FRESH_ROUND,

  contestants: [SOLO_YOU],
  you: SOLO_YOU,

  start: (count, playerName) => {
    const you: Contestant = {id: 'you', name: playerName || 'You', score: 0, isYou: true};
    set({
      count,
      round: 1,
      rounds: buildRounds(count),
      contestants: [you],
      you,
      ...FRESH_ROUND,
    });
  },

  hydrate: (rounds, contestants) => {
    const you = contestants.find(c => c.isYou) ?? SOLO_YOU;
    set({
      round: 1,
      rounds,
      count: rounds.length,
      contestants,
      you,
      ...FRESH_ROUND,
    });
  },

  syncContestants: incoming =>
    set(state => {
      const youId = state.you.id;
      const merged = incoming.map(c =>
        c.id === youId ? {...c, score: state.you.score, isYou: true} : c,
      );
      const you = merged.find(c => c.id === youId) ?? state.you;
      return {contestants: merged, you};
    }),

  lockAnswer: (optionIndex, fractionRemaining) =>
    set(state => {
      if (state.answered) {
        return state;
      }
      const round = state.rounds[state.index];
      const correct = optionIndex !== null && optionIndex === round.outlierIndex;
      return {
        selected: optionIndex,
        answered: true,
        pendingPoints: scoreAnswer(correct, fractionRemaining),
      };
    }),

  reveal: () =>
    set(state => {
      if (state.phase !== 'question') {
        return state; // idempotent — only the question phase reveals
      }
      const prevRankById = ranksById(rankContestants(state.contestants));
      const newScore = state.you.score + state.pendingPoints;
      const you = {...state.you, score: newScore};
      const contestants = state.contestants.map(c => (c.id === you.id ? you : c));
      return {
        phase: 'reveal',
        lastPoints: state.pendingPoints,
        contestants,
        you,
        prevRankById,
      };
    }),

  showStandings: () => set({phase: 'standings'}),

  next: () =>
    set(state => ({
      index: state.index + 1,
      phase: 'question',
      selected: null,
      answered: false,
      pendingPoints: 0,
      lastPoints: 0,
    })),

  playAgain: () =>
    set(state => {
      const you = {...state.you, score: 0};
      const contestants = state.contestants.map(c => ({...c, score: 0}));
      return {
        round: state.round + 1,
        rounds: buildRounds(state.count),
        contestants,
        you,
        ...FRESH_ROUND,
      };
    }),
}));
