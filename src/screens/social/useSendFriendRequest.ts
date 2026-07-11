/**
 * The send-a-friend-request flow behind the Friends tab's search offer card:
 * one call wraps the RPC, the toast for every outcome (sent, auto-accepted,
 * already pending, already friends), the follow-up push, and the
 * push-permission nudge. Lives in the screens layer because it talks toast
 * and i18n; the pure code detection lives in core/social/friendSearch.
 */
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {toast} from '../../core/ui';
import {isNetworkError} from '../../core/rooms/roomService';
import {requestPushPermissionAndSync} from '../../core/notifications/pushInvites';
import {refreshFriendRequests} from '../../core/social/requestsStore';
import {
  isOwnCodeError,
  isUnknownCodeError,
  sendFriendRequest,
  sendFriendPush,
} from '../../core/social/socialService';

type Options = {
  /** Fired when an auto-accept created a friendship — the feed has a new card. */
  onFriendAdded: () => void;
  /** Fired when the request landed (sent or auto-accepted) — close the search. */
  onSent?: () => void;
};

export function useSendFriendRequest({onFriendAdded, onSent}: Options) {
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);

  async function send(code: string) {
    const trimmed = code.trim();
    if (trimmed.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      const {outcome, friend} = await sendFriendRequest(trimmed);
      const name = friend.displayName;
      switch (outcome) {
        case 'requested':
          toast.success(t('social.requestSent', {name}));
          sendFriendPush('friend_request', friend.userId).catch(() => {});
          onSent?.();
          break;
        case 'autoAccepted':
          // Their pending ask + ours fused into a friendship on the spot.
          toast.success(t('social.friendAdded', {name}));
          sendFriendPush('request_accepted', friend.userId).catch(() => {});
          onFriendAdded();
          onSent?.();
          break;
        case 'alreadyRequested':
          toast.neutral(t('social.requestAlreadySent', {name}));
          break;
        case 'alreadyFriends':
          toast.neutral(t('social.alreadyFriends', {name}));
          break;
      }
      // Sending is also the moment this phone becomes push-reachable for the
      // answer — make sure permission is granted and the token uploaded.
      requestPushPermissionAndSync().catch(() => {});
      refreshFriendRequests();
    } catch (err) {
      if (isUnknownCodeError(err)) {
        toast.error(t('social.errorNotFound'));
      } else if (isOwnCodeError(err)) {
        toast.error(t('social.errorSelf'));
      } else {
        toast.error(
          isNetworkError(err) ? t('common.errorNetwork') : t('social.errorRequest'),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return {send, busy};
}
