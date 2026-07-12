import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {toast} from '../core/ui';
import {haptics} from '../core/haptics';
import type {RootStackParamList} from '../core/navigation';
import {
  playMove,
  proposeTie,
  recordGameResults,
  respondTie,
  restartBoardGame,
  returnToLobby,
  subscribeRoom,
} from '../core/rooms/roomService';
import {entriesFromStandings, matchIdFrom} from '../core/stats/recordEntries';
import {
  createConnectionNotifier,
  notifyPartyClosed,
} from '../core/rooms/connectionStatus';
import {useOptimisticRoomState} from '../core/rooms/useOptimisticRoomState';
import {ensureSession} from '../core/supabase/client';
import {HattrickGameView} from '../games/hattrick/HattrickGameView';
import {createRematchState} from '../games/hattrick/engine';
import type {GridState} from '../games/hattrick/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Hattrick'>;

/**
 * Online Hattrick — the thin container around `HattrickGameView`. Follows the
 * room over realtime, ships view-computed states through the `play_move` RPC,
 * and runs the host-only lifecycle (restart, return to lobby). The board UI
 * itself lives in the shared game view (also used by pass-and-play).
 */
export function HattrickScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  // My own moves paint immediately; the Realtime echo stays authoritative.
  const {state, applyServer, applyOptimistic} =
    useOptimisticRoomState<GridState>();
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const leftRef = useRef(false);

  useEffect(() => {
    ensureSession().then(setMyUserId).catch(() => {});
    const unsub = subscribeRoom(
      roomId,
      room => {
        setHostId(room.hostId);
        // Host ended the game / returned to lobby → follow back.
        if (room.status !== 'in_progress' || !room.gameState) {
          if (!leftRef.current) {
            leftRef.current = true;
            navigation.goBack();
          }
          return;
        }
        applyServer(room.gameState as GridState);
      },
      // Host left the party entirely (no host, no party) → back to the menu,
      // popping straight past the now-dead lobby.
      ({selfIsHost}) => {
        if (!leftRef.current) {
          leftRef.current = true;
          notifyPartyClosed(selfIsHost);
          navigation.popToTop();
        }
      },
      createConnectionNotifier(),
    );
    return unsub;
  }, [roomId, navigation, applyServer]);

  const isHost = !!myUserId && myUserId === hostId;

  // Host records the result once the board has a winner (0031). Only individual
  // games: in teams mode the side ids are 'A'/'B', not the user ids game_results
  // is keyed on. Score is 1 for the winning side, 0 otherwise, so a tie records
  // as a draw (0/0). Keyed by the grid's axis signature, so a Play again (fresh
  // grid, same room) records as a distinct game.
  const recordedMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !state || state.winner === null || state.mode !== 'individual') {
      return;
    }
    const signature = state.signature ?? JSON.stringify([state.rows, state.cols]);
    const matchId = matchIdFrom(roomId, signature);
    if (recordedMatchRef.current === matchId) {
      return;
    }
    recordedMatchRef.current = matchId;
    const board = state.sides.map(side => ({
      userId: side.id,
      name: side.name,
      score: state.winner === side.id ? 1 : 0,
    }));
    recordGameResults(matchId, roomId, entriesFromStandings(board), 'hattrick').catch(
      () => {},
    );
  }, [isHost, state, roomId]);

  // Shared catch for room RPCs: the action never reached the server (offline,
  // timeout), so buzz and say so instead of failing silently.
  function notifyNetworkError() {
    haptics.error();
    toast.error(t('common.errorNetwork'));
  }

  // Back: a guest just leaves to their (still-mounted) lobby and can rejoin; the
  // host returns the whole party to the lobby to pick a new game.
  function handleBack() {
    if (isHost) {
      returnToLobby(roomId).catch(notifyNetworkError);
    } else {
      leftRef.current = true;
      navigation.goBack();
    }
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    try {
      // Avoid repeating this exact grid or letting the same player start again.
      await restartBoardGame(roomId, createRematchState(state));
    } catch {
      toast.error(t('hattrick.newGameError'));
    }
  }

  return (
    <HattrickGameView
      state={state}
      perspective={{kind: 'online', myUserId}}
      onCommit={next =>
        applyOptimistic(next, () => playMove(roomId, next)).catch(
          notifyNetworkError,
        )
      }
      onProposeTie={() =>
        proposeTie(roomId).catch(() => toast.error(t('hattrick.proposeError')))
      }
      onRespondTie={accept => respondTie(roomId, accept).catch(notifyNetworkError)}
      onPlayAgain={playAgain}
      onExit={() => returnToLobby(roomId).catch(notifyNetworkError)}
      exitLabel={t('hattrick.backToLobby')}
      onBack={handleBack}
      showResultActions={isHost}
    />
  );
}
