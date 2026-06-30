/**
 * Missing XI room behaviour for the shared lobby. Registers at module load so
 * the game-agnostic Lobby/Join screens can run it without importing the game.
 */
import {registerGameRoom} from '../../core/rooms/gameRoom';
import type {RoomPlayer} from '../../core/rooms/types';
import {QUESTION_DURATION_MS} from '../quiz/scoring';
import {DEFAULT_QUESTION_COUNT, type MissingQuestion} from './mockData';
import {buildQuestions} from './questions';
import {contestantsFromPlayers, useMissingStore} from './store';

registerGameRoom({
  gameType: 'missing-xi',
  questionRoute: 'MissingXiQuestion',
  firstPhaseDurationMs: QUESTION_DURATION_MS,
  buildDeck: ({count}) => buildQuestions(count ?? DEFAULT_QUESTION_COUNT),
  hydrate: (deck, roster: readonly RoomPlayer[], myUserId) => {
    useMissingStore
      .getState()
      .hydrate(deck as MissingQuestion[], contestantsFromPlayers(roster, myUserId));
  },
  lobbySubtitle: ({count}) => {
    const lineups = count ?? DEFAULT_QUESTION_COUNT;
    return `${lineups} line-ups`;
  },
});
