/**
 * Push taps: a well-formed `{type:'party-invite', code}` payload navigates to
 * Join, friend-request lifecycle payloads land on the Friends tab, the same
 * notification never fires twice (a press can arrive through both the event
 * listener and getInitialNotification), and a tap that lands before the
 * navigator mounts is parked until onReady.
 */
import {navigationRef} from '../../navigation/navigationRef';
import {refreshFriendRequests} from '../../social/requestsStore';
import {refreshInvites} from '../notificationsStore';
import {flushPendingNavigation, handleNotificationPress} from '../pushInvites';

jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: {isReady: jest.fn(() => true), navigate: jest.fn()},
}));

jest.mock('../../social/requestsStore', () => ({
  refreshFriendRequests: jest.fn(() => Promise.resolve()),
}));

jest.mock('../notificationsStore', () => ({
  refreshInvites: jest.fn(() => Promise.resolve()),
}));

const isReady = navigationRef.isReady as jest.Mock;
const navigate = navigationRef.navigate as unknown as jest.Mock;
const refresh = refreshFriendRequests as jest.Mock;
const refreshInv = refreshInvites as jest.Mock;

beforeEach(() => {
  isReady.mockReturnValue(true);
  navigate.mockClear();
  refresh.mockClear();
  refreshInv.mockClear();
});

function invite(code: string, id?: string) {
  return {id, data: {type: 'party-invite', code}};
}

function friendPush(type: string, id?: string) {
  return {id, data: {type}};
}

test('a party-invite press joins via the Join screen', () => {
  handleNotificationPress(invite('ABCD'));
  expect(navigate).toHaveBeenCalledWith('Join', {code: 'ABCD'});
});

test('codes are normalized to uppercase', () => {
  handleNotificationPress(invite('abcd'));
  expect(navigate).toHaveBeenCalledWith('Join', {code: 'ABCD'});
});

test('other notifications and malformed codes are ignored', () => {
  handleNotificationPress(undefined);
  handleNotificationPress({data: {type: 'something-else', code: 'ABCD'}});
  handleNotificationPress(invite('TOOLONG'));
  handleNotificationPress(invite(''));
  expect(navigate).not.toHaveBeenCalled();
});

// Friend pushes land on Profile, which holds the friends list (and the pending
// requests) now that the Friends tab is gone.
test('a friend-request press lands on the Profile tab with a refetch', () => {
  handleNotificationPress(friendPush('friend-request'));
  expect(refresh).toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith('Tabs', {
    tab: 'profile',
    at: expect.any(Number),
  });
});

test('a friend-accepted press lands on the Profile tab too', () => {
  handleNotificationPress(friendPush('friend-accepted'));
  expect(navigate).toHaveBeenCalledWith('Tabs', {
    tab: 'profile',
    at: expect.any(Number),
  });
});

test('the same notification id is handled once', () => {
  handleNotificationPress(invite('WXYZ', 'notif-1'));
  handleNotificationPress(invite('WXYZ', 'notif-1'));
  expect(navigate).toHaveBeenCalledTimes(1);

  handleNotificationPress(friendPush('friend-request', 'notif-2'));
  handleNotificationPress(friendPush('friend-request', 'notif-2'));
  expect(navigate).toHaveBeenCalledTimes(2);
});

test('a press before the navigator is ready is parked for onReady', () => {
  isReady.mockReturnValue(false);
  handleNotificationPress(invite('QRST'));
  expect(navigate).not.toHaveBeenCalled();

  isReady.mockReturnValue(true);
  flushPendingNavigation();
  expect(navigate).toHaveBeenCalledWith('Join', {code: 'QRST'});
  // Flushing again must not re-join.
  flushPendingNavigation();
  expect(navigate).toHaveBeenCalledTimes(1);
});

test('a cold-start friend-request press is parked and lands on Profile', () => {
  isReady.mockReturnValue(false);
  handleNotificationPress(friendPush('friend-request'));
  expect(navigate).not.toHaveBeenCalled();

  isReady.mockReturnValue(true);
  flushPendingNavigation();
  expect(navigate).toHaveBeenCalledWith('Tabs', {
    tab: 'profile',
    at: expect.any(Number),
  });
});

/**
 * The bell's dot is computed from the store, and the store only refetches on
 * launch and on foreground — neither of which happens when the push lands while
 * you're already in the app. Without a refresh here the invite sits on the
 * server, Home shows no dot, and it only appears once you happen to open the
 * bell (which refetches on mount). That was the observed bug: "no dot, but it
 * says join".
 */
test('a party-invite refreshes the invite store, so the bell can dot', () => {
  handleNotificationPress(invite('ABCD'));
  expect(refreshInv).toHaveBeenCalled();
});

test('a friend-request does not refetch invites, and vice versa', () => {
  handleNotificationPress(friendPush('friend-request'));
  expect(refresh).toHaveBeenCalled();
  expect(refreshInv).not.toHaveBeenCalled();

  refresh.mockClear();
  handleNotificationPress(invite('EFGH'));
  expect(refreshInv).toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});
