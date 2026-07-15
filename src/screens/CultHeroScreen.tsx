import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {toast} from '../core/ui';
import {haptics} from '../core/haptics';
import type {RootStackParamList} from '../core/navigation';
import {
  playMove,
  recordGameResults,
  restartCultHeroGame,
  returnToLobby,
  submitCultHeroAnswer,
  subscribeRoom,
} from '../core/rooms/roomService';
import {entriesFromStandings, matchIdFrom} from '../core/stats/recordEntries';
import {
  createConnectionNotifier,
  notifyPartyClosed,
} from '../core/rooms/connectionStatus';
import {ensureSession} from '../core/supabase/client';
import {CultHeroGameView} from '../games/cult-hero/CultHeroGameView';
import {advanceRoundReveal, standings} from '../games/cult-hero/engine';
import {buildPromptPayloads} from '../games/cult-hero/famePrior';
import {notePrompts, takeSessionPrompts} from '../games/cult-hero/prompts';
import type {CultHeroState} from '../games/cult-hero/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CultHero'>;

/**
 * Online Cult Hero — one device per player, the room over realtime. Owns the
 * subscription, the host's RPCs and the result recording; `CultHeroGameView`
 * draws the game itself, exactly as pass-and-play draws it.
 */
export function CultHeroScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const [state, setState] = useState<CultHeroState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const leftRef = useRef(false);

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
        setState(room.gameState as CultHeroState);
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

  // Host records the final result once the game reaches the 'final' phase
  // (0031). Keyed by the game's prompts so a Play again (fresh prompts, same
  // room) records as a distinct game; the ref stops it re-firing every render.
  const recordedMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'final') {
      return;
    }
    const matchId = matchIdFrom(roomId, state.promptKeys.join('|'));
    if (recordedMatchRef.current === matchId) {
      return;
    }
    recordedMatchRef.current = matchId;
    recordGameResults(
      matchId,
      roomId,
      entriesFromStandings(standings(state)),
      'cult-hero',
    ).catch(() => {});
  }, [isHost, state, roomId]);

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

  // Host pages the one-by-one result reveal; the server put the turn on the
  // host when the round resolved, so play_move only accepts the host here.
  function advanceReveal() {
    if (!state) {
      return;
    }
    haptics.press();
    playMove(roomId, advanceRoundReveal(state)).catch(notifyNetworkError);
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    try {
      // Make sure the current game is in the party's prompt history even if
      // the app restarted mid-session, then deal prompts it hasn't seen yet.
      notePrompts(roomId, state.promptKeys);
      await restartCultHeroGame(
        roomId,
        state.rounds,
        buildPromptPayloads(takeSessionPrompts(roomId, state.rounds)),
      );
    } catch {
      toast.error(t('cultHero.newGameError'));
    }
  }

  return (
    <CultHeroGameView
      state={state}
      perspective={{kind: 'online', myUserId}}
      // Nothing to hide behind a gate: every device has its own screen.
      gate={null}
      onShowContent={() => {}}
      onSubmitPick={footballerId => submitCultHeroAnswer(roomId, footballerId)}
      // The server takes the last write until the round resolves, so a pick
      // stays changeable.
      pickIsFinal={false}
      onAdvance={advanceReveal}
      onPlayAgain={playAgain}
      onExit={() => returnToLobby(roomId).catch(notifyNetworkError)}
      exitLabel={t('cultHero.backToLobby')}
      onBack={handleBack}
      showResultActions={isHost}
      canAdvance={isHost}
    />
  );
}
