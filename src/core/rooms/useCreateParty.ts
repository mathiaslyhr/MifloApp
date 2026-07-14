/**
 * useCreateParty — the one place that mints a party room and hands off to the
 * Lobby. A room is created under a random funny football name (you rename
 * yourself in the lobby by tapping your avatar); pass a `gameType` to lock the
 * party to a game, or omit it to let the host pick in the lobby.
 *
 * The create → navigate → error-toast dance used to be copy-pasted in
 * HomeScreen and GamesScreen; this hook is its single home so new call sites
 * (the skin-3 Home dashboard) share the exact behaviour.
 */
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {toast} from '../ui';
import {useAppNavigation} from '../navigation';
import {createRoom, BackendUnavailableError} from './roomService';
import {randomFootballName} from '../identity/funnyName';

/** A room is created game-less by default; the host picks in the lobby. */
const NO_GAME_YET = 'unset';

export function useCreateParty() {
  const navigation = useAppNavigation();
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);

  async function createParty(gameType: string = NO_GAME_YET) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const room = await createRoom(gameType, [], 0, randomFootballName());
      navigation.navigate('Lobby', {roomId: room.id});
    } catch (err) {
      toast.error(
        err instanceof BackendUnavailableError
          ? t('home.errorUnavailable')
          : t('home.errorCreate'),
      );
    } finally {
      setBusy(false);
    }
  }

  return {createParty, busy};
}
