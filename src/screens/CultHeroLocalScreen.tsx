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
  CultHeroGameView,
  type CultHeroPerspective,
} from '../games/cult-hero/CultHeroGameView';
import {
  advanceLocalReveal,
  createLocalCultHeroGame,
  createLocalCultHeroRematch,
  handoffPlayer,
  LOCAL_MIN_PLAYERS,
  showPick,
  submitLocalPick,
} from '../games/cult-hero/localEngine';
import {
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUNDS,
} from '../games/cult-hero/types';
import type {LocalCultHeroState} from '../games/cult-hero/localEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'CultHeroLocal'>;

/**
 * Pass-and-play Cult Hero — the rarest-answer game on one shared phone, fully
 * offline. The whole game is the pure engine over local state: no room, no
 * Supabase, no network, so it works in flight mode.
 *
 * Same phases, same board, same scoring as online. The shared phone only adds
 * the handoff gate (which keeps each pick secret) and the lock-in that replaces
 * the online resubmit window. Rarity is scored by the fame prior alone — no
 * global stats offline, by design.
 */
export function CultHeroLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [state, setState] = useState<LocalCultHeroState | null>(null);
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
      setState(createLocalCultHeroGame(names, rounds));
    } catch {
      toast.error(t('cultHero.newGameError'));
    }
  }

  function playAgain() {
    haptics.press();
    try {
      setState(s => (s ? createLocalCultHeroRematch(s) : s));
    } catch {
      toast.error(t('cultHero.newGameError'));
    }
  }

  function advance() {
    haptics.press();
    setState(s => (s ? advanceLocalReveal(s) : s));
  }

  // Whose eyes the phone is in front of. Only meaningful while answering; the
  // reveal, leaderboard and final are "phone in the middle" with no actor.
  const actor = state ? handoffPlayer(state) : undefined;

  const perspective: CultHeroPerspective = {
    kind: 'local',
    actorUserId: actor?.userId ?? '',
    handoff: {
      index: (state?.handoffIndex ?? 0) + 1,
      total: state?.players.length ?? 0,
    },
  };

  const gate: PassGateSpec | null =
    state && state.phase === 'answering' && !state.contentShown && actor
      ? {
          title: t('cultHero.local.passTo', {name: actor.name}),
          sub: t('cultHero.local.pickIntro', {name: actor.name}),
          actionLabel: t('cultHero.local.showPick'),
        }
      : null;

  return (
    <CultHeroGameView
      state={state}
      perspective={perspective}
      gate={gate}
      onShowContent={() => setState(s => (s ? showPick(s) : s))}
      onSubmitPick={async footballerId => {
        setState(s => (s ? submitLocalPick(s, footballerId) : s));
      }}
      // After the pass the pick is final — there is no server to take a
      // last write, and the phone has moved on.
      pickIsFinal
      onAdvance={advance}
      onPlayAgain={playAgain}
      onExit={() => navigation.goBack()}
      exitLabel={t('cultHero.local.exit')}
      onBack={() => navigation.goBack()}
      showResultActions
      canAdvance
      setupSlot={
        <LocalSetupStage
          copy={{
            title: t('cultHero.local.setupTitle'),
            sub: t('cultHero.local.setupSub', {count: LOCAL_MIN_PLAYERS}),
            namePlaceholder: t('cultHero.local.namePlaceholder'),
            addPlayer: t('cultHero.local.addPlayer'),
            removePlayer: t('cultHero.local.removePlayer'),
            roundsLabel: t('cultHero.roundsPicker.label'),
            start: t('cultHero.local.start'),
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
