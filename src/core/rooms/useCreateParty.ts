/**
 * useCreateParty — the one place that mints a party room and hands off to the
 * Lobby. You show up under your profile name (rename yourself in the lobby by
 * tapping your avatar — that's room-local and never touches the profile); pass
 * a `gameType` to lock the party to a game, or omit it to let the host pick in
 * the lobby.
 *
 * The create → navigate → error-toast dance lives only here so every call
 * site shares the exact behaviour.
 */
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {toast} from '../ui';
import {useAppNavigation} from '../navigation';
import {createRoom, BackendUnavailableError} from './roomService';
import {myPlayerName} from '../social/socialService';

/** A room is created game-less by default; the host picks in the lobby. */
const NO_GAME_YET = 'unset';

export function useCreateParty() {
  const navigation = useAppNavigation();
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);

  /**
   * `replace` swaps the calling screen for the Lobby instead of pushing over
   * it — used by the game-mode sheet, which must not sit in the stack
   * underneath a live room.
   */
  async function createParty(
    gameType: string = NO_GAME_YET,
    {replace = false}: {replace?: boolean} = {},
  ) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const room = await createRoom(gameType, [], 0, await myPlayerName());
      if (replace) {
        navigation.replace('Lobby', {roomId: room.id});
      } else {
        navigation.navigate('Lobby', {roomId: room.id});
      }
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
