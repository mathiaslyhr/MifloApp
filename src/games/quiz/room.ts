/**
 * Quiz room behaviour for the shared lobby. Registers at module load so the
 * game-agnostic Lobby/Join screens can run the quiz without importing it.
 */
import {registerGameRoom} from '../../core/rooms/gameRoom';
import type {RoomPlayer} from '../../core/rooms/types';
import {DEFAULT_QUESTION_COUNT, DEFAULT_TOPIC_IDS, type Question} from './mockData';
import {buildQuestions} from './questions';
import {QUESTION_DURATION_MS} from './scoring';
import {contestantsFromPlayers, useQuizStore} from './store';

registerGameRoom({
  gameType: 'quiz',
  questionRoute: 'QuizQuestion',
  firstPhaseDurationMs: QUESTION_DURATION_MS,
  buildDeck: ({topicIds, count}) =>
    buildQuestions(topicIds ?? DEFAULT_TOPIC_IDS, count ?? DEFAULT_QUESTION_COUNT),
  hydrate: (deck, roster: readonly RoomPlayer[], myUserId) => {
    useQuizStore
      .getState()
      .hydrate(deck as Question[], contestantsFromPlayers(roster, myUserId));
  },
  lobbySubtitle: ({topicIds, count}) => {
    const questionCount = count ?? DEFAULT_QUESTION_COUNT;
    const topics = topicIds ?? DEFAULT_TOPIC_IDS;
    return `${questionCount} questions · ${topics.length} topics`;
  },
});
