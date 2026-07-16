/**
 * The bell's feed: friend requests and party invites, merged and time-sorted.
 *
 * Both sources are server truth, so the feed is either right or absent —
 * nothing here infers. Daily nudges are deliberately NOT here: they're receipts
 * you've already seen, and a TIMESTAMP trigger fires with no code running, so a
 * log could only guess (see the design doc).
 *
 * `invites === null` means "not loaded yet", the same convention requestsStore
 * uses, so the bell's dot stays off rather than flickering on stale truth.
 */
import {AppState} from 'react-native';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {create} from 'zustand';
import {isBackendConfigured} from '../config';
import {fetchMyPartyInvites} from '../rooms/roomService';
import {refreshFriendRequests} from '../social/requestsStore';
import {getCachedProfile} from '../social/socialService';
import {ensureSession, supabase} from '../supabase/client';
import type {FriendRequest, PartyInvite} from '../social/types';

export type NotificationItem =
  | {kind: 'friend-request'; at: string; request: FriendRequest}
  | {kind: 'invite'; at: string; invite: PartyInvite};

/** Both sources into one list, newest first. Pure — the screen's whole model. */
export function mergeFeed(
  requests: readonly FriendRequest[],
  invites: readonly PartyInvite[],
): NotificationItem[] {
  const items: NotificationItem[] = [
    ...requests.map(request => ({
      kind: 'friend-request' as const,
      at: request.createdAt,
      request,
    })),
    ...invites.map(invite => ({
      kind: 'invite' as const,
      at: invite.createdAt,
      invite,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * How many items are newer than the last read. A tie counts as READ: opening
 * the screen stamps `now`, and an item stamped the same instant must not
 * resurrect the dot.
 */
export function unreadCount(
  items: readonly NotificationItem[],
  lastReadAt: string | null,
): number {
  if (!lastReadAt) {
    return items.length;
  }
  return items.filter(i => i.at.localeCompare(lastReadAt) > 0).length;
}

type NotificationsState = {
  invites: PartyInvite[] | null;
  /** True when the last fetch failed — the feed shows a retry row, not a lie. */
  invitesError: boolean;
  lastReadAt: string | null;
  setInvites: (invites: PartyInvite[] | null, error?: boolean) => void;
  markAllRead: () => void;
};

export const useNotificationsStore = create<NotificationsState>(set => ({
  invites: null,
  invitesError: false,
  lastReadAt: null,
  setInvites: (invites, error = false) => set({invites, invitesError: error}),
  markAllRead: () => set({lastReadAt: new Date().toISOString()}),
}));

/**
 * Fetch invites into the store. A no-op before the device opts into Friends,
 * and never throws: an unapplied 0046 or a dropped connection must leave the
 * bell showing friend requests, not an error screen.
 */
export async function refreshInvites(): Promise<void> {
  if (!isBackendConfigured) {
    return;
  }
  try {
    if (!(await getCachedProfile())) {
      useNotificationsStore.getState().setInvites([]);
      return;
    }
    useNotificationsStore.getState().setInvites(await fetchMyPartyInvites());
  } catch {
    // Keep whatever we had and flag it so the feed can offer a retry. Dropping
    // the list because one fetch blinked is the blank bell this exists to avoid.
    const {invites, setInvites} = useNotificationsStore.getState();
    setInvites(invites, true);
  }
}

let watching = false;

/**
 * App-lifetime refresh: once now, then on every foreground — an invite may have
 * arrived while the app slept and its push been dismissed, which is the exact
 * case this feed exists for. Mirrors startRequestsRefresh.
 */
export function startNotificationsRefresh(): void {
  if (watching || !isBackendConfigured) {
    return;
  }
  watching = true;
  refreshInvites();
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      refreshInvites();
      // A socket doesn't survive a long sleep; re-subscribe on every return.
      subscribeToNotifications();
    }
  });
  subscribeToNotifications();
}

let channel: RealtimeChannel | null = null;

/**
 * Listen for the two things the bell shows, so the dot appears as they land
 * rather than on the next foreground.
 *
 * This is here because the alternatives don't work. Refreshing when the push
 * ARRIVES would be ideal, but notifee's DELIVERED is for trigger notifications
 * and never fires for a remote APNs push in the iOS foreground. Polling would
 * mean hammering my_party_invites, which sweeps expired rows on every read —
 * one DELETE per poll, per user, to keep a badge fresh. The server already
 * knows; realtime just lets it say so (rooms and the ranked queue have worked
 * this way since 0001/0034).
 *
 * RLS filters the stream, so `to_user_id`/`addressee` can only ever be us —
 * but the filters are explicit anyway: a subscription that leans on RLS alone
 * is one policy change away from being a firehose.
 */
async function subscribeToNotifications(): Promise<void> {
  if (!supabase) {
    return;
  }
  const uid = await ensureSession();
  if (!uid) {
    return;
  }
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  channel = supabase
    .channel(`notifications:${uid}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'party_invites',
        filter: `to_user_id=eq.${uid}`,
      },
      () => refreshInvites(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `addressee=eq.${uid}`,
      },
      // Not just INSERT: a request you accept elsewhere must stop dotting.
      () => refreshFriendRequests(),
    )
    .subscribe();
}
