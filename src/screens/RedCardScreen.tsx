import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {toast} from '../core/ui';
import {haptics} from '../core/haptics';
import type {RootStackParamList} from '../core/navigation';
import {
  castRedCardVote,
  getMyRedCardRole,
  redCardGuess,
  playMove,
  recordGameResults,
  restartRedCardGame,
  returnToLobby,
  submitRedCardAnswer,
  subscribeRoom,
  type ImposterRoleResult,
} from '../core/rooms/roomService';
import {entriesFromStandings, matchIdFrom} from '../core/stats/recordEntries';
import {
  createConnectionNotifier,
  notifyPartyClosed,
} from '../core/rooms/connectionStatus';
import {ensureSession} from '../core/supabase/client';
import {RedCardGameView} from '../games/red-card/RedCardGameView';
import {
  advanceAnswerReveal,
  buildFootballerPool,
} from '../games/red-card/engine';
import {
  noteSessionQuestions,
  takeSessionQuestions,
} from '../games/red-card/questions';
import type {PassGateSpec} from '../games/shared/localPlay';
import type {ImposterState} from '../games/red-card/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RedCard'>;

/**
 * Online Red Card — one device per player, the room over realtime. Owns the
 * subscription, this device's private role fetch, the host's RPCs and the
 * result recording; `RedCardGameView` draws the hand itself, exactly as
 * pass-and-play draws it.
 */
export function RedCardScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const [state, setState] = useState<ImposterState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ImposterRoleResult | null>(null);
  const [roleDismissed, setRoleDismissed] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  // The shared "finished" beat: everyone lands on voting at once, so the grid
  // stays behind a gate until this device says it's ready. Lives here, next to
  // the other per-hand flags, so a fresh hand always re-arms it.
  const [voteStarted, setVoteStarted] = useState(false);
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
        setState(room.gameState as ImposterState);
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

  // Fetch ONLY my own role from the server (never in the broadcast state). The
  // secret is written before the room flips to in_progress, but retry once in
  // case this device sees the state first. On failure, say so and quietly try
  // once more after a beat — otherwise a blip strands the player behind the
  // "Dealing roles…" card with a disabled button.
  const fetchRole = useCallback(() => {
    const fail = () => {
      haptics.error();
      toast.error(t('redCard.errorRole'));
      setTimeout(() => {
        getMyRedCardRole(roomId)
          .then(r => r && setRole(r))
          .catch(() => {});
      }, 2000);
    };
    getMyRedCardRole(roomId)
      .then(r => {
        if (r) {
          setRole(r);
        } else {
          setTimeout(() => {
            getMyRedCardRole(roomId)
              .then(rr => rr && setRole(rr))
              .catch(fail);
          }, 600);
        }
      })
      .catch(fail);
  }, [roomId, t]);

  // A hand always opens in the 'answering' phase. Reset per-hand local state
  // and re-fetch the role only when a hand starts fresh — on first mount or on
  // Play again after a reveal (which re-randomises the imposter and
  // footballer). Coming back from 'answerReveal' is just the next round of the
  // SAME hand, so nothing resets.
  useEffect(() => {
    if (!state) {
      return;
    }
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    const freshHand = prev === undefined || prev === 'reveal';
    if (state.phase === 'answering' && freshHand) {
      setRole(null);
      setRoleDismissed(false);
      setHasVoted(false);
      setVoteStarted(false);
      fetchRole();
    } else if (prev === undefined) {
      // Mounted mid-hand (force-quit + rejoin): recover this device's role
      // without resetting the per-hand flags.
      fetchRole();
    }
  }, [state?.phase, state, fetchRole]);

  const isHost = !!myUserId && myUserId === hostId;

  // Host records each hand's result once its reveal is fully resolved (0031).
  // A Red Card hand is a self-contained game: the score is this hand's delta
  // (not the running total), so each hand is its own head-to-head match, keyed
  // by the hand's questions + imposter. A caught imposter guesses blind, so wait
  // until the redemption has settled before recording the final deltas.
  const recordedMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'reveal' || !state.reveal) {
      return;
    }
    const reveal = state.reveal;
    const awaitingGuess = reveal.caught && !reveal.redemption;
    if (awaitingGuess) {
      return;
    }
    const matchId = matchIdFrom(
      roomId,
      `${state.questionIds.join(',')}|${reveal.imposterId}`,
    );
    if (recordedMatchRef.current === matchId) {
      return;
    }
    recordedMatchRef.current = matchId;
    const board = state.players.map(p => ({
      userId: p.userId,
      name: p.name,
      score: reveal.deltas[p.userId] ?? 0,
    }));
    recordGameResults(
      matchId,
      roomId,
      entriesFromStandings(board),
      'red-card',
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

  // Host pages the one-by-one answer reveal; the server put the turn on the
  // host when the round resolved, so play_move only accepts the host here.
  function advanceReveal() {
    if (!state) {
      return;
    }
    haptics.press();
    playMove(roomId, advanceAnswerReveal(state)).catch(notifyNetworkError);
  }

  async function castVote(targetUserId: string) {
    if (hasVoted) {
      return;
    }
    setHasVoted(true);
    try {
      await castRedCardVote(roomId, targetUserId);
    } catch (e) {
      setHasVoted(false);
      throw e;
    }
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    try {
      // Make sure the current hand is in the party's ask history even if the
      // app restarted mid-session, then deal questions it hasn't heard yet.
      noteSessionQuestions(roomId, state.questionIds);
      await restartRedCardGame(
        roomId,
        buildFootballerPool(),
        state.rounds,
        takeSessionQuestions(roomId, state.rounds),
      );
    } catch {
      toast.error(t('redCard.newGameError'));
    }
  }

  // The one gate this mode uses: the shared "Ready to vote?" beat, so a fast
  // tapper can't vote before reading the grid.
  const gate: PassGateSpec | null =
    state?.phase === 'voting' && !voteStarted && !hasVoted
      ? {
          title: t('redCard.vote.ready'),
          sub: t('redCard.vote.readySub'),
          actionLabel: t('redCard.vote.start'),
        }
      : null;

  return (
    <RedCardGameView
      state={state}
      perspective={{kind: 'online', myUserId, role}}
      gate={gate}
      onShowContent={() => setVoteStarted(true)}
      roleShown={state?.phase === 'answering' && !roleDismissed}
      roleAckLabel={t('redCard.role.gotIt')}
      onRoleAck={() => setRoleDismissed(true)}
      onSubmitAnswer={text => submitRedCardAnswer(roomId, text)}
      onAdvanceAnswers={advanceReveal}
      onVote={castVote}
      onGuess={footballerId => redCardGuess(roomId, footballerId)}
      hasVoted={hasVoted}
      onPlayAgain={playAgain}
      onExit={() => returnToLobby(roomId).catch(notifyNetworkError)}
      exitLabel={t('redCard.backToLobby')}
      onBack={handleBack}
      showResultActions={isHost}
      canPageAnswers={isHost}
    />
  );
}
