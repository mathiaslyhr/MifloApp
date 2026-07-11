/**
 * One-tap party invite, shared by the Friends tab and the friend profile
 * page: create a free-pick room, jump into its lobby, and push the invite to
 * the friend while it opens. The push is fire-and-forget — the lobby is
 * already opening — with the global toast reporting how it went.
 */
import type {TFunction} from 'i18next';
import {toast} from '../../core/ui';
import {
  BackendUnavailableError,
  createRoom,
} from '../../core/rooms/roomService';
import type {RootNavigation} from '../../core/navigation';
import {randomFootballName} from '../../core/identity/funnyName';
import {
  getCachedProfile,
  sendPartyInvite,
} from '../../core/social/socialService';
import type {SocialProfile} from '../../core/social/types';

/** Same free-pick sentinel Home uses — the game is chosen in the lobby. */
const NO_GAME_YET = 'unset';

export async function inviteFriendToParty(
  navigation: RootNavigation,
  friend: SocialProfile,
  t: TFunction,
): Promise<void> {
  try {
    // The social display name when opted in; a party name works fine too.
    const myName = (await getCachedProfile())?.displayName ?? randomFootballName();
    const room = await createRoom(NO_GAME_YET, [], 0, myName);
    navigation.navigate('Lobby', {
      roomId: room.id,
      invitedFriendId: friend.userId,
    });
    sendPartyInvite(friend.userId, room.code)
      .then(res => {
        if (res.ok) {
          toast.success(t('invite.sentToast', {name: friend.displayName}));
        } else if (res.reason === 'no_token') {
          toast.neutral(t('invite.unreachableToast', {name: friend.displayName}));
        } else {
          toast.error(t('invite.errorSend'));
        }
      })
      .catch(() => toast.error(t('invite.errorSend')));
  } catch (err) {
    toast.error(
      err instanceof BackendUnavailableError
        ? t('home.errorUnavailable')
        : t('home.errorCreate'),
    );
  }
}
