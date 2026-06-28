/**
 * Quiz game state. Holds the shared deck, round progress, and the contestants.
 *
 * Solo play seeds a single contestant (`you`) locally via `start`. A networked
 * game seeds the room's real players via `hydrate`, and `syncContestants` merges
 * their live scores in from Supabase Realtime — your own score stays local (it's
 * applied at reveal and pushed up separately) so an incoming sync can't clobber
 * an in-flight answer. Standings rank the full list by real points.
 *
 * The phase machine (question → reveal → standings) still runs locally per
 * device; M4 will drive those transitions from the host instead of local timers.
 */
import {create} from 'zustand';
import type {RoomPlayer} from '../../core/rooms/types';
import type {Question} from './mockData';
import {buildQuestions, usedFootballers} from './questions';
import {
  rankContestants,
  ranksById,
  scoreAnswer,
  type Contestant,
} from './scoring';

/** Which part of a question's lifecycle we're in. Drives the round screen. */
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

type QuizStore = {
  // Config carried across rounds
  topicIds: string[];
  count: number;
  round: number;
  /** Footballers used in past rounds, so a new round stays fresh. */
  seenFootballers: Set<string>;

  // Current round
  questions: Question[];
  index: number;
  phase: Phase;
  selected: number | null;
  answered: boolean;
  /** Points the locked answer is worth, applied to the score at reveal. */
  pendingPoints: number;
  lastPoints: number;

  // Contestants — `you` is a convenience pointer to the local player's entry.
  contestants: Contestant[];
  you: Contestant;
  /** Ranks before the latest answer, for movement arrows. */
  prevRankById: Record<string, number>;

  /** Start a local/solo game: generate a deck with just you as contestant. */
  start: (topicIds: string[], count: number, playerName: string) => void;
  /** Start a networked game from a room's shared deck + real players. */
  hydrate: (questions: Question[], contestants: Contestant[]) => void;
  /** Merge live scores from the room; keeps your own (local) score intact. */
  syncContestants: (incoming: Contestant[]) => void;
  /** Lock in an answer during the question phase (no score change yet). */
  lockAnswer: (optionIndex: number | null, fractionRemaining: number) => void;
  /** Close the question: apply your points and show the result. */
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

export const useQuizStore = create<QuizStore>(set => ({
  topicIds: [],
  count: 0,
  round: 1,
  seenFootballers: new Set(),

  questions: [],
  ...FRESH_ROUND,

  contestants: [SOLO_YOU],
  you: SOLO_YOU,

  start: (topicIds, count, playerName) => {
    const you: Contestant = {id: 'you', name: playerName || 'You', score: 0, isYou: true};
    set({
      topicIds,
      count,
      round: 1,
      seenFootballers: new Set(),
      questions: buildQuestions(topicIds, count),
      contestants: [you],
      you,
      ...FRESH_ROUND,
    });
  },

  hydrate: (questions, contestants) => {
    const you = contestants.find(c => c.isYou) ?? SOLO_YOU;
    set({
      round: 1,
      seenFootballers: new Set(),
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
      // Take server scores for everyone but you; keep your local score so an
      // in-flight answer isn't reverted by a stale broadcast.
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
      const question = state.questions[state.index];
      const correct =
        optionIndex !== null && optionIndex === question.correctIndex;
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
      // Snapshot ranks before this question's points land, for movement arrows.
      const prevRankById = ranksById(rankContestants(state.contestants));
      const newScore = state.you.score + state.pendingPoints;
      const you = {...state.you, score: newScore};
      const contestants = state.contestants.map(c =>
        c.id === you.id ? you : c,
      );
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
      const seen = new Set(state.seenFootballers);
      for (const id of usedFootballers(state.questions)) {
        seen.add(id);
      }
      let questions = buildQuestions(state.topicIds, state.count, {exclude: seen});
      // Pool exhausted — wipe freshness and reuse the full set.
      if (questions.length === 0) {
        seen.clear();
        questions = buildQuestions(state.topicIds, state.count);
      }
      const you = {...state.you, score: 0};
      const contestants = state.contestants.map(c => ({...c, score: 0}));
      return {
        round: state.round + 1,
        seenFootballers: seen,
        questions,
        contestants,
        you,
        ...FRESH_ROUND,
      };
    }),
}));
