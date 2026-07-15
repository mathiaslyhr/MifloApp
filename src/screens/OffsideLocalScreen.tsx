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
  OffsideGameView,
  type OffsidePerspective,
} from '../games/offside/OffsideGameView';
import {
  advanceLocalOffside,
  createLocalOffsideGame,
  createLocalOffsideRematch,
  handoffPlayer,
  LOCAL_MIN_PLAYERS,
  revealQuestion,
  submitLocalAnswer,
} from '../games/offside/localEngine';
import {DEFAULT_ROUNDS, MAX_ROUNDS, MIN_ROUNDS} from '../games/offside/types';
import type {LocalOffsideState} from '../games/offside/localEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'OffsideLocal'>;

/**
 * Pass-and-play Offside — the odd-one-out race on one shared phone, fully
 * offline. The whole game is the pure engine over local state: no room, no
 * Supabase, no network, so it works in flight mode.
 *
 * Same cards, same clock, same speed scoring as online. The shared phone only
 * adds the handoff gate, which turns the simultaneous race into turns: each
 * player's personal clock starts the moment THEY reveal the cards, so a turn is
 * worth exactly what it would be online.
 */
export function OffsideLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [state, setState] = useState<LocalOffsideState | null>(null);
  const [names, setNames] = useState<string[]>(['', '']);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);

  const namesReady =
    names.filter(n => n.trim().length > 0).length >= LOCAL_MIN_PLAYERS;

  function start() {
    if (!namesReady) {
      return;
    }
    haptics.press();
    try {
      setState(createLocalOffsideGame(names, rounds));
    } catch {
      toast.error(t('offside.newGameError'));
    }
  }

  function playAgain() {
    haptics.press();
    try {
      setState(s => (s ? createLocalOffsideRematch(s) : s));
    } catch {
      toast.error(t('offside.newGameError'));
    }
  }

  function advance() {
    haptics.press();
    setState(s => (s ? advanceLocalOffside(s) : s));
  }

  // Whose turn it is. Only meaningful during a question; the reveal, scoreboard
  // and standings are "phone in the middle" with no actor.
  const actor = state ? handoffPlayer(state) : undefined;

  const perspective: OffsidePerspective = {
    kind: 'local',
    actorUserId: actor?.userId ?? '',
    handoff: {
      index: (state?.handoffIndex ?? 0) + 1,
      total: state?.order.length ?? 0,
    },
  };

  const gate: PassGateSpec | null =
    state && state.phase === 'question' && !state.contentShown && actor
      ? {
          title: t('offside.local.passTo', {name: actor.name}),
          sub: t('offside.local.questionIntro', {name: actor.name}),
          actionLabel: t('offside.local.showCards'),
        }
      : null;

  return (
    <OffsideGameView
      state={state}
      perspective={perspective}
      // The actor's personal clock, started when they revealed the cards.
      deadline={state?.deadline ?? null}
      gate={gate}
      onShowContent={() => setState(s => (s ? revealQuestion(s) : s))}
      onSubmit={async option => {
        // Points are recomputed inside the engine off the same deadline, so the
        // view's number is display-only here.
        setState(s => (s ? submitLocalAnswer(s, option) : s));
      }}
      onAdvance={advance}
      onPlayAgain={playAgain}
      onExit={() => navigation.goBack()}
      exitLabel={t('offside.local.exit')}
      onBack={() => navigation.goBack()}
      showResultActions
      canAdvance
      // Rule 2 differs: on one phone the race runs in turns, not all at once.
      helpLines={[
        {text: t('offside.help.rule1')},
        {text: t('offside.local.helpRule2')},
        {text: t('offside.help.rule3')},
      ]}
      setupSlot={
        <LocalSetupStage
          copy={{
            title: t('offside.local.setupTitle'),
            sub: t('offside.local.setupSub', {count: LOCAL_MIN_PLAYERS}),
            namePlaceholder: t('offside.local.namePlaceholder'),
            addPlayer: t('offside.local.addPlayer'),
            removePlayer: t('offside.local.removePlayer'),
            roundsLabel: t('offside.roundsPicker.label'),
            start: t('offside.local.start'),
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
