import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../core/navigation';
import {HattrickGameView} from '../games/hattrick/HattrickGameView';
import {generateGrid} from '../games/hattrick/grid';
import {
  createIndividualState,
  createRematchState,
  proposeTie,
  respondTie,
} from '../games/hattrick/engine';
import type {GridState} from '../games/hattrick/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HattrickLocal'>;

/**
 * Pass-and-play Hattrick — two people sharing one phone. The whole game is the
 * pure engine over local state: no room, no Supabase, no network, so it works
 * in flight mode. Same board, same rules, same 2-minute turn clock as online.
 */
export function HattrickLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [state, setState] = useState<GridState>(() =>
    createIndividualState(generateGrid(Math.random), [
      {userId: 'p1', name: t('hattrick.local.player1')},
      {userId: 'p2', name: t('hattrick.local.player2')},
    ]),
  );

  // The tie handshake runs on the shared phone: the turn holder proposes, then
  // the phone is shown to the other player, whose answer resolves the offer.
  function handleProposeTie() {
    setState(s => proposeTie(s, s.turnUserId));
  }

  function handleRespondTie(accept: boolean) {
    setState(s => {
      const offer = s.tieOffer;
      if (!offer) {
        return s;
      }
      const responder = s.sides.find(side => !offer.accepted.includes(side.id));
      return responder ? respondTie(s, responder.memberUserIds[0], accept) : s;
    });
  }

  return (
    <HattrickGameView
      state={state}
      perspective={{kind: 'local'}}
      onCommit={setState}
      onProposeTie={handleProposeTie}
      onRespondTie={handleRespondTie}
      onPlayAgain={() => setState(s => createRematchState(s))}
      onExit={() => navigation.goBack()}
      exitLabel={t('hattrick.local.exit')}
      onBack={() => navigation.goBack()}
      showResultActions
    />
  );
}
