/**
 * Missing XI game state. Same phase machine and shared scoring as the other
 * games; the only difference is the answer — a typed player name rather than an
 * option index. A guess is correct when it names the hidden player (accents,
 * casing, surname, and aliases all accepted; see matching.ts).
 */
import {create} from 'zustand';
import type {RoomPlayer} from '../../core/rooms/types';
import {
  rankContestants,
  ranksById,
  scoreAnswer,
  type Contestant,
} from '../quiz/scoring';
import {buildQuestions} from './questions';
import {isCorrectGuess} from './matching';
import type {MissingQuestion} from './mockData';

export type Phase = 'question' | 'reveal' | 'standings';

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

type MissingStore = {
  count: number;
  round: number;

  questions: MissingQuestion[];
  index: number;
  phase: Phase;
  /** The locked guess text (null = no answer / timed out). */
  guess: string | null;
  answered: boolean;
  pendingPoints: number;
  lastPoints: number;

  contestants: Contestant[];
  you: Contestant;
  prevRankById: Record<string, number>;

  start: (count: number, playerName: string) => void;
  hydrate: (questions: MissingQuestion[], contestants: Contestant[]) => void;
  syncContestants: (incoming: Contestant[]) => void;
  /** Lock in a typed guess during the question phase (no score change yet). */
  lockAnswer: (guess: string | null, fractionRemaining: number) => void;
  reveal: () => void;
  showStandings: () => void;
  next: () => void;
  playAgain: () => void;
};

const SOLO_YOU: Contestant = {id: 'you', name: 'You', score: 0, isYou: true};

const FRESH_ROUND = {
  index: 0,
  phase: 'question' as Phase,
  guess: null,
  answered: false,
  pendingPoints: 0,
  lastPoints: 0,
  prevRankById: {} as Record<string, number>,
};

export const useMissingStore = create<MissingStore>(set => ({
  count: 0,
  round: 1,

  questions: [],
  ...FRESH_ROUND,

  contestants: [SOLO_YOU],
  you: SOLO_YOU,

  start: (count, playerName) => {
    const you: Contestant = {id: 'you', name: playerName || 'You', score: 0, isYou: true};
    set({
      count,
      round: 1,
      questions: buildQuestions(count),
      contestants: [you],
      you,
      ...FRESH_ROUND,
    });
  },

  hydrate: (questions, contestants) => {
    const you = contestants.find(c => c.isYou) ?? SOLO_YOU;
    set({
      round: 1,
      questions,
      count: questions.length,
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

  lockAnswer: (guess, fractionRemaining) =>
    set(state => {
      if (state.answered) {
        return state;
      }
      const question = state.questions[state.index];
      const hidden = question.players[question.hiddenIndex];
      const correct = guess !== null && isCorrectGuess(guess, hidden);
      return {
        guess,
        answered: true,
        pendingPoints: scoreAnswer(correct, fractionRemaining),
      };
    }),

  reveal: () =>
    set(state => {
      if (state.phase !== 'question') {
        return state;
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
      guess: null,
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
        questions: buildQuestions(state.count),
        contestants,
        you,
        ...FRESH_ROUND,
      };
    }),
}));
