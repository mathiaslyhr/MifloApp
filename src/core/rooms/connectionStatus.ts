/**
 * Turns raw realtime channel health into user-facing toasts. The transport
 * layer (roomService) stays i18n/UI-free; screens pass one of these as the
 * `onStatus` callback so players hear about a dropped live connection instead
 * of silently staring at a stale roster or board.
 */
import i18n from '../i18n';
import {toast} from '../ui';
import type {ChannelStatus} from './roomService';

/**
 * One per screen: returns an `onStatus` callback that toasts once when the
 * connection drops and once when it comes back. Share a single notifier
 * across a screen's channels so one outage produces one toast, not one per
 * channel. `CLOSED` is ignored — it also fires on normal unsubscribe/unmount.
 */
export function createConnectionNotifier(): (status: ChannelStatus) => void {
  let lost = false;
  return status => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      if (!lost) {
        lost = true;
        toast.neutral(i18n.t('common.connectionLost'));
      }
    } else if (status === 'SUBSCRIBED' && lost) {
      lost = false;
      toast.success(i18n.t('common.connectionRestored'));
    }
  };
}
