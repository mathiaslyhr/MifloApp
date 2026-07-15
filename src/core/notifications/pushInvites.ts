/**
 * Remote (APNs) push plumbing — the one place remote notifications are
 * handled. Two halves:
 *
 * Token: after the user grants notification permission, the native
 * PushTokenModule registers with Apple and hands back the device token, which
 * is uploaded via `set_push_token` so friends' pushes can reach this phone.
 * Synced silently on every launch (no prompt) and actively wherever the user
 * takes a push-related action (opening the invite sheet, opting into
 * Friends).
 *
 * Tap: a party invite (`{type:'party-invite', code}`) navigates to the Join
 * screen, whose existing auto-join takes it from there; friend-request
 * lifecycle pushes (`{type:'friend-request' | 'friend-accepted'}`) land on
 * the Friends tab with the requests freshly fetched. Presses arrive through
 * three doors depending on app state — foreground event, background event
 * (registered at module scope in index.js), and getInitialNotification after
 * a cold start — so handling is deduped by notification id.
 */
import notifee, {AuthorizationStatus, EventType} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules} from 'react-native';
import {navigationRef} from '../navigation/navigationRef';
import {refreshFriendRequests} from '../social/requestsStore';
import {getCachedProfile, uploadPushToken} from '../social/socialService';
import type {TabId} from '../ui';

const LAST_UPLOADED_KEY = 'push.lastUploadedToken';

type PushTokenNative = {getApnsToken: () => Promise<string>};

/** Party codes are 4 chars from gen_code's alphabet; anything else is noise. */
const CODE_RE = /^[A-Z0-9]{4}$/;

/** Where a push tap wants to land. Friend pushes go to Profile, which holds
 * the friends list now that the Friends tab is gone. */
type PendingNavigation =
  | {kind: 'join'; code: string}
  | {kind: 'tab'; tab: TabId};

let pending: PendingNavigation | null = null;
const handledIds = new Set<string>();

function performNavigation(target: PendingNavigation): void {
  if (target.kind === 'join') {
    navigationRef.navigate('Join', {code: target.code});
  } else {
    // `at` makes repeat taps distinct params, so TabsScreen's effect refires.
    navigationRef.navigate('Tabs', {tab: target.tab, at: Date.now()});
  }
}

function navigateOrPark(target: PendingNavigation): void {
  if (navigationRef.isReady()) {
    performNavigation(target);
  } else {
    // Cold start: the container isn't mounted yet. Stash the target; App.tsx
    // flushes it from NavigationContainer's onReady.
    pending = target;
  }
}

/** Called from NavigationContainer onReady (App.tsx). */
export function flushPendingNavigation(): void {
  if (pending && navigationRef.isReady()) {
    const target = pending;
    pending = null;
    performNavigation(target);
  }
}

type PressedNotification = {
  id?: string;
  data?: Record<string, unknown>;
};

/** Exported for tests and shared by all three press doors. */
export function handleNotificationPress(
  notification: PressedNotification | undefined,
): void {
  const data = notification?.data;
  const type = data?.type;

  let target: PendingNavigation | null = null;
  if (type === 'party-invite') {
    const code = String(data?.code ?? '').toUpperCase();
    if (!CODE_RE.test(code)) {
      return;
    }
    target = {kind: 'join', code};
  } else if (type === 'friend-request' || type === 'friend-accepted') {
    // Profile holds the friends list (and the pending requests) now.
    target = {kind: 'tab', tab: 'profile'};
  } else {
    return;
  }

  const id = notification?.id;
  if (id) {
    if (handledIds.has(id)) {
      return;
    }
    handledIds.add(id);
  }
  if (type === 'friend-request' || type === 'friend-accepted') {
    // Refetch so the Requests section / new friend is there when we land.
    refreshFriendRequests();
  }
  navigateOrPark(target);
}

/**
 * Foreground press listener + cold-start catch-up. Call once from App.tsx;
 * returns the unsubscribe.
 */
export function initPushInviteListeners(): () => void {
  const unsubscribe = notifee.onForegroundEvent(({type, detail}) => {
    if (type === EventType.PRESS) {
      handleNotificationPress(detail.notification);
    }
  });
  notifee
    .getInitialNotification()
    .then(initial => {
      if (initial) {
        handleNotificationPress(initial.notification);
      }
    })
    .catch(() => {});
  return unsubscribe;
}

/**
 * Background press handler. Notifee requires this registered at module scope
 * outside React — called from index.js.
 */
export function registerPushInviteBackgroundHandler(): void {
  notifee.onBackgroundEvent(async ({type, detail}) => {
    if (type === EventType.PRESS) {
      handleNotificationPress(detail.notification);
    }
  });
}

async function uploadCurrentToken(): Promise<void> {
  // Without a Friends profile nobody can invite this phone; don't collect
  // tokens for devices that never opted in.
  if (!(await getCachedProfile())) {
    return;
  }
  const native = NativeModules.PushTokenModule as PushTokenNative | undefined;
  if (!native?.getApnsToken) {
    return;
  }
  const token = (await native.getApnsToken()).toLowerCase();
  const last = await AsyncStorage.getItem(LAST_UPLOADED_KEY);
  if (last === token) {
    return;
  }
  await uploadPushToken(token);
  await AsyncStorage.setItem(LAST_UPLOADED_KEY, token);
}

/**
 * Silent launch-time sync: re-uploads the token only when permission was
 * already granted (the daily-reminder opt-in or an earlier invite flow asked).
 * Never prompts, never throws.
 */
export async function syncPushToken(): Promise<void> {
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
      return;
    }
    await uploadCurrentToken();
  } catch {
    // Push is best-effort everywhere; the app works fine without it.
  }
}

/**
 * The active path: prompt for permission (first time shows the system dialog)
 * and sync the token. Returns whether notifications are authorized — the
 * upload itself stays best-effort so a network blip can't block the caller.
 */
export async function requestPushPermissionAndSync(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();
    const granted =
      settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
    if (granted) {
      uploadCurrentToken().catch(() => {});
    }
    return granted;
  } catch {
    return false;
  }
}
