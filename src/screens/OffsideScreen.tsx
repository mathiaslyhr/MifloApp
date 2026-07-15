import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {toast} from '../core/ui';
import {haptics} from '../core/haptics';
import type {RootStackParamList} from '../core/navigation';
import {
  advanceOffsideRound,
  forceOffsideReveal,
  recordGameResults,
  restartOffsideGame,
  returnToLobby,
  submitOffsideAnswer,
  subscribeRoom,
} from '../core/rooms/roomService';
import {entriesFromStandings, matchIdFrom} from '../core/stats/recordEntries';
import {
  createConnectionNotifier,
  notifyPartyClosed,
} from '../core/rooms/connectionStatus';
import {ensureSession} from '../core/supabase/client';
import {OffsideGameView} from '../games/offside/OffsideGameView';
import {deadlineTs, standings} from '../games/offside/engine';
import {buildRounds} from '../games/offside/questions';
import {FORCE_REVEAL_GRACE_MS} from '../games/offside/types';
import type {OffsideState} from '../games/offside/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Offside'>;

/**
 * Offside — the online odd-one-out race. The broadcast room state is the single
 * source of truth (deck, phase, answers, scores); this container subscribes to
 * it and pushes the player's own actions through the 0017 RPCs, so rejoining
 * mid-game lands exactly where the room is. `OffsideGameView` draws the race
 * itself, exactly as pass-and-play draws it.
 */
export function OffsideScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const [state, setState] = useState<OffsideState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const leftRef = useRef(false);
  const prevPhaseRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    ensureSession().then(setMyUserId).catch(() => {});
    const unsub = subscribeRoom(
      roomId,
      room => {
        setHostId(room.hostId);
        // Host returned the party to the lobby / ended the game → follow back.
        if (room.status !== 'in_progress' || !room.gameState) {
          if (!leftRef.current) {
            leftRef.current = true;
            navigation.goBack();
          }
          return;
        }
        setState(room.gameState as OffsideState);
      },
      // Host left the party entirely (no host, no party) → back to the menu.
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
  }, [roomId, navigation]);

  const isHost = !!myUserId && myUserId === hostId;
  const deadline = state ? deadlineTs(state) : null;

  // Host records the final result once the game reaches its standings (0031).
  // Keyed by the deck's content so a Play again (fresh deck, same room) records
  // as a distinct game; the ref stops it re-firing on every standings render.
  const recordedMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'standings') {
      return;
    }
    const signature = state.deck
      .map(r => `${r.cards.map(c => c.footballerId).join('-')}:${r.outlierIndex}`)
      .join('|');
    const matchId = matchIdFrom(roomId, signature);
    if (recordedMatchRef.current === matchId) {
      return;
    }
    recordedMatchRef.current = matchId;
    recordGameResults(
      matchId,
      roomId,
      entriesFromStandings(standings(state)),
      'offside',
    ).catch(() => {});
  }, [isHost, state, roomId]);

  // Entering a reveal: buzz by how your own round went. (Pass-and-play has no
  // "you" at the reveal, so it buzzes at its own timeout instead.)
  useEffect(() => {
    if (!state || !myUserId) {
      return;
    }
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    if (prev === 'question' && state.phase === 'reveal') {
      const mine = state.answers[myUserId];
      const round = state.deck[state.round - 1];
      if (mine?.option != null && mine.option === round?.outlierIndex) {
        haptics.success();
      } else {
        haptics.error();
      }
    }
  }, [state, myUserId]);

  // Host safety net: once the deadline (plus grace) passes with the question
  // still open, force the reveal so a leaver/backgrounded player can't stall
  // the round. The server rejects premature calls and no-ops resolved ones.
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'question' || deadline == null) {
      return;
    }
    const wait = Math.max(0, deadline + FORCE_REVEAL_GRACE_MS - Date.now());
    const timer = setTimeout(() => {
      forceOffsideReveal(roomId).catch(() => {});
    }, wait);
    return () => clearTimeout(timer);
  }, [isHost, state, deadline, roomId]);

  // Shared catch for room RPCs: the action never reached the server (offline,
  // timeout), so buzz and say so instead of failing silently.
  function notifyNetworkError() {
    haptics.error();
    toast.error(t('common.errorNetwork'));
  }

  function handleBack() {
    if (isHost) {
      returnToLobby(roomId).catch(notifyNetworkError);
    } else {
      leftRef.current = true;
      navigation.goBack();
    }
  }

  function advance() {
    haptics.press();
    advanceOffsideRound(roomId).catch(notifyNetworkError);
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    try {
      const deck = buildRounds(state.rounds);
      if (deck.length === 0) {
        throw new Error('Offside deck came back empty');
      }
      await restartOffsideGame(roomId, deck, deck.length);
    } catch {
      toast.error(t('offside.newGameError'));
    }
  }

  return (
    <OffsideGameView
      state={state}
      perspective={{kind: 'online', myUserId}}
      deadline={deadline}
      // Nothing to hide behind a gate: every device has its own screen.
      gate={null}
      onShowContent={() => {}}
      onSubmit={(option, points) =>
        state
          ? submitOffsideAnswer(roomId, state.round, option, points)
          : Promise.resolve()
      }
      onAdvance={advance}
      onPlayAgain={playAgain}
      onExit={() => returnToLobby(roomId).catch(notifyNetworkError)}
      exitLabel={t('offside.backToLobby')}
      onBack={handleBack}
      showResultActions={isHost}
      canAdvance={isHost}
      helpLines={[
        {text: t('offside.help.rule1')},
        {text: t('offside.help.rule2')},
        {text: t('offside.help.rule3')},
      ]}
    />
  );
}
