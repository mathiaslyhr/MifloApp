/**
 * Odd One Out room behaviour for the shared lobby. Registers at module load so
 * the game-agnostic Lobby/Join screens can run it without importing the game.
 */
import {registerGameRoom} from '../../core/rooms/gameRoom';
import type {RoomPlayer} from '../../core/rooms/types';
import {QUESTION_DURATION_MS} from '../quiz/scoring';
import {DEFAULT_ROUND_COUNT, type OddRound} from './mockData';
import {buildRounds} from './questions';
import {contestantsFromPlayers, useOddStore} from './store';

registerGameRoom({
  gameType: 'odd-one-out',
  questionRoute: 'OddOneOutQuestion',
  firstPhaseDurationMs: QUESTION_DURATION_MS,
  buildDeck: ({count}) => buildRounds(count ?? DEFAULT_ROUND_COUNT),
  hydrate: (deck, roster: readonly RoomPlayer[], myUserId) => {
    useOddStore
      .getState()
      .hydrate(deck as OddRound[], contestantsFromPlayers(roster, myUserId));
  },
  lobbySubtitle: ({count}) => {
    const rounds = count ?? DEFAULT_ROUND_COUNT;
    return `${rounds} rounds`;
  },
});
