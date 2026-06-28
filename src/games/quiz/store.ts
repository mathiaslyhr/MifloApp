/**
 * Local quiz game state for the M1 single-device loop. Holds the generated
 * deck, progress, and the player's score.
 *
 * Contestants are kept as a list (just `you` for now) so the Standings/Podium
 * screens already work; M3 adds real players to that list via Supabase Realtime
 * hydrating this same store. No fake/simulated opponents.
 */
import {create} from 'zustand';
import type {Question} from './mockData';
import {buildQuestions, usedFootballers} from './questions';
import {
  rankContestants,
  ranksById,
  scoreAnswer,
  type Contestant,
} from './scoring';

/** Which part of a question's lifecycle we're in. Drives the round screen and,
 *  in M3, comes from the host's Realtime broadcast instead of local timers. */
export type Phase = 'question' | 'reveal' | 'standings';

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

  // Contestants (just you for now; real players join in M3)
  you: Contestant;
  /** Ranks before the latest answer, for movement arrows. */
  prevRankById: Record<string, number>;

  start: (topicIds: string[], count: number, playerName: string) => void;
  /** Lock in an answer during the question phase (no score change yet). */
  lockAnswer: (optionIndex: number | null, fractionRemaining: number) => void;
  /** Close the question: apply everyone's points and show the result. */
  reveal: () => void;
  showStandings: () => void;
  next: () => void;
  playAgain: () => void;
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  topicIds: [],
  count: 0,
  round: 1,
  seenFootballers: new Set(),

  questions: [],
  index: 0,
  phase: 'question',
  selected: null,
  answered: false,
  pendingPoints: 0,
  lastPoints: 0,

  you: {id: 'you', name: 'You', score: 0, isYou: true},
  prevRankById: {},

  start: (topicIds, count, playerName) =>
    set(() => ({
      topicIds,
      count,
      round: 1,
      seenFootballers: new Set(),
      questions: buildQuestions(topicIds, count),
      index: 0,
      phase: 'question',
      selected: null,
      answered: false,
      pendingPoints: 0,
      lastPoints: 0,
      you: {id: 'you', name: playerName || 'You', score: 0, isYou: true},
      prevRankById: {},
    })),

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
      // Snapshot ranks before this question's points land, so the standings
      // can show who moved up or down (once there are multiple players).
      const prevRankById = ranksById(rankContestants([state.you]));
      return {
        phase: 'reveal',
        lastPoints: state.pendingPoints,
        you: {...state.you, score: state.you.score + state.pendingPoints},
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
      return {
        round: state.round + 1,
        seenFootballers: seen,
        questions,
        index: 0,
        phase: 'question',
        selected: null,
        answered: false,
        pendingPoints: 0,
        lastPoints: 0,
        you: {...state.you, score: 0},
        prevRankById: {},
      };
    }),
}));
