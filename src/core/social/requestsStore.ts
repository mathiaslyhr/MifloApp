/**
 * Friend-request state, held in a tiny Zustand store (same shape as the toast
 * store) so the tab shell can badge the Friends tab without the Social page
 * ever mounting a fetch, and so a push tap / accept / decline can refresh it
 * imperatively from outside React.
 *
 * `requests === null` means "not loaded yet" — the badge stays off rather
 * than flickering on stale truth.
 */
import {AppState} from 'react-native';
import {create} from 'zustand';
import {isBackendConfigured} from '../config';
import {fetchFriendRequests, getCachedProfile} from './socialService';
import type {FriendRequests} from './types';

type RequestsState = {
  requests: FriendRequests | null;
  setRequests: (requests: FriendRequests | null) => void;
};

export const useRequestsStore = create<RequestsState>(set => ({
  requests: null,
  setRequests: requests => set({requests}),
}));

/**
 * Fetch pending requests and publish them to the store. Quietly a no-op
 * before the device opts into Friends (no cached profile) and swallows
 * network errors — callers fire this blind from launch, foreground, tab
 * focus, and after every send/accept/decline.
 */
export async function refreshFriendRequests(): Promise<void> {
  if (!isBackendConfigured) {
    return;
  }
  try {
    if (!(await getCachedProfile())) {
      return;
    }
    useRequestsStore.getState().setRequests(await fetchFriendRequests());
  } catch {
    // Best-effort: keep whatever the store has; the next signal retries.
  }
}

let watching = false;

/**
 * App-lifetime refresh: once now and again on every return to the foreground
 * (a request may have arrived while the app slept and its push been
 * dismissed). Safe to start unconditionally from App.tsx, like
 * startPresenceHeartbeat.
 */
export function startRequestsRefresh(): void {
  if (watching || !isBackendConfigured) {
    return;
  }
  watching = true;
  refreshFriendRequests();
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      refreshFriendRequests();
    }
  });
}
