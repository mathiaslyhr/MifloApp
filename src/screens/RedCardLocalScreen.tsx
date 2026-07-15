import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {toast} from '../core/ui';
import {haptics} from '../core/haptics';
import type {RootStackParamList} from '../core/navigation';
import {
  LOCAL_MAX_PLAYERS,
  LocalSetupStage,
  type PassGateSpec,
} from '../games/shared/localPlay';
import {
  RedCardGameView,
  type RedCardPerspective,
} from '../games/red-card/RedCardGameView';
import {awaitingRedemption} from '../games/red-card/engine';
import {
  advanceLocalAnswerReveal,
  applyLocalRedemption,
  castLocalVote,
  createLocalGame,
  createLocalRematch,
  handoffPlayer,
  hideAndPass,
  LOCAL_MIN_PLAYERS,
  localRole,
  showContent,
  submitLocalAnswer,
} from '../games/red-card/localEngine';
import {DEFAULT_ROUNDS, MAX_ROUNDS, MIN_ROUNDS} from '../games/red-card/types';
import type {LocalRedCardState} from '../games/red-card/localEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'RedCardLocal'>;

/**
 * Pass-and-play Red Card — the imposter hunt on one shared phone, fully
 * offline. The whole game is the pure engine over local state: no room, no
 * Supabase, no network, so it works in flight mode.
 *
 * Same role card, same questions, same vote, same reveal as online. The shared
 * phone only adds the handoff gate in front of each private moment: online the
 * secrets hide server-side, here they hide behind "Pass the phone to X".
 *
 * NOTE: this container holds the secrets in memory and must NEVER import
 * `core/rooms/*` — there is no room to send them to, and putting a
 * `LocalRedCardState` on the wire would broadcast the imposter. An eslint
 * `no-restricted-imports` override on `*LocalScreen.tsx` enforces it.
 */
export function RedCardLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [state, setState] = useState<LocalRedCardState | null>(null);
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);

  const namesReady =
    names.filter(n => n.trim().length > 0).length >= LOCAL_MIN_PLAYERS;

  function start() {
    if (!namesReady) {
      return;
    }
    haptics.press();
    try {
      setState(createLocalGame(names, rounds));
    } catch {
      toast.error(t('redCard.newGameError'));
    }
  }

  function playAgain() {
    haptics.press();
    try {
      setState(s => (s ? createLocalRematch(s) : s));
    } catch {
      toast.error(t('redCard.newGameError'));
    }
  }

  // Whose eyes the phone is in front of. During the reveal's blind guess that's
  // the imposter; otherwise it's whoever the order is up to.
  const actor = state ? handoffPlayer(state) : undefined;

  const perspective: RedCardPerspective = {
    kind: 'local',
    actorUserId: actor?.userId ?? '',
    // The secrets are on the local state, so the actor's role is never null.
    role:
      state && actor
        ? localRole(state, actor.userId)
        : {role: 'detective', footballerId: ''},
    handoff: {
      index: (state?.handoffIndex ?? 0) + 1,
      total: state?.order.length ?? 0,
    },
  };

  /** The pass gate for whatever private moment is up. */
  function buildGate(): PassGateSpec | null {
    if (!state || state.contentShown || !actor) {
      return null;
    }
    const passTo = t('redCard.local.passTo', {name: actor.name});
    if (state.roleTrip) {
      return {
        title: passTo,
        sub: t('redCard.local.roleIntro', {name: actor.name}),
        actionLabel: t('redCard.local.showRole'),
      };
    }
    if (state.phase === 'answering') {
      return {
        title: passTo,
        sub: t('redCard.local.answerIntro'),
        actionLabel: t('redCard.local.showAnswer'),
      };
    }
    if (state.phase === 'voting') {
      return {
        title: passTo,
        sub: t('redCard.local.voteIntro'),
        actionLabel: t('redCard.local.showVote'),
      };
    }
    if (awaitingRedemption(state)) {
      return {
        title: passTo,
        sub: t('redCard.local.redeemPass'),
        actionLabel: t('redCard.redeem.button'),
      };
    }
    return null;
  }

  return (
    <RedCardGameView
      state={state}
      perspective={perspective}
      gate={buildGate()}
      onShowContent={() => setState(s => (s ? showContent(s) : s))}
      roleShown={state?.roleTrip ?? false}
      roleAckLabel={t('redCard.local.hideAndPass')}
      onRoleAck={() => setState(s => (s ? hideAndPass(s) : s))}
      onSubmitAnswer={async text => {
        setState(s => (s ? submitLocalAnswer(s, text) : s));
      }}
      onAdvanceAnswers={() => {
        haptics.press();
        setState(s => (s ? advanceLocalAnswerReveal(s) : s));
      }}
      onVote={async targetUserId => {
        setState(s => (s ? castLocalVote(s, targetUserId) : s));
      }}
      onGuess={async footballerId => {
        setState(s => (s ? applyLocalRedemption(s, footballerId) : s));
      }}
      // Voting is the pass here, so there is never a table to wait on.
      hasVoted={false}
      onPlayAgain={playAgain}
      onExit={() => navigation.goBack()}
      exitLabel={t('redCard.local.exit')}
      onBack={() => navigation.goBack()}
      showResultActions
      canPageAnswers
      setupSlot={
        <LocalSetupStage
          copy={{
            title: t('redCard.local.setupTitle'),
            sub: t('redCard.local.setupSub', {count: LOCAL_MIN_PLAYERS}),
            namePlaceholder: t('redCard.local.namePlaceholder'),
            addPlayer: t('redCard.local.addPlayer'),
            removePlayer: t('redCard.local.removePlayer'),
            roundsLabel: t('redCard.roundsPicker.label'),
            start: t('redCard.local.start'),
          }}
          names={names}
          onChange={setNames}
          minPlayers={LOCAL_MIN_PLAYERS}
          maxPlayers={LOCAL_MAX_PLAYERS}
          rounds={rounds}
          onRounds={setRounds}
          minRounds={MIN_ROUNDS}
          maxRounds={MAX_ROUNDS}
          ready={namesReady}
          onStart={start}
        />
      }
    />
  );
}
