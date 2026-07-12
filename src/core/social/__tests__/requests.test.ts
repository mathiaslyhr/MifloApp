/**
 * partitionRequests: raw participant-scoped friend_requests rows + counterpart
 * profiles → {incoming, outgoing} for the Friends tab, newest first, rows with
 * missing profiles dropped.
 */
import {partitionRequests, type FriendRequestRow} from '../requests';
import type {SocialProfile} from '../types';

const ME = 'me-uuid';

function profile(userId: string, displayName = userId): SocialProfile {
  return {
    userId,
    displayName,
    friendCode: 'ABC123',
    lastSeenAt: null,
    avatarPath: null,
    favoritePlayerId: null,
    favoriteClubId: null,
    favoriteNation: null,
  };
}

function row(requester: string, addressee: string, createdAt: string): FriendRequestRow {
  return {requester, addressee, createdAt};
}

test('splits rows by direction around the caller', () => {
  const rows = [
    row('anna', ME, '2026-07-10T10:00:00Z'),
    row(ME, 'bo', '2026-07-10T11:00:00Z'),
  ];
  const result = partitionRequests(rows, [profile('anna'), profile('bo')], ME);
  expect(result.incoming.map(r => r.profile.userId)).toEqual(['anna']);
  expect(result.outgoing.map(r => r.profile.userId)).toEqual(['bo']);
});

test('sorts each side newest first', () => {
  const rows = [
    row('old', ME, '2026-07-01T00:00:00Z'),
    row('new', ME, '2026-07-10T00:00:00Z'),
    row(ME, 'older-out', '2026-06-01T00:00:00Z'),
    row(ME, 'newer-out', '2026-07-09T00:00:00Z'),
  ];
  const profiles = ['old', 'new', 'older-out', 'newer-out'].map(id => profile(id));
  const result = partitionRequests(rows, profiles, ME);
  expect(result.incoming.map(r => r.profile.userId)).toEqual(['new', 'old']);
  expect(result.outgoing.map(r => r.profile.userId)).toEqual(['newer-out', 'older-out']);
});

test('drops rows whose counterpart profile is missing', () => {
  const rows = [
    row('ghost', ME, '2026-07-10T00:00:00Z'),
    row('anna', ME, '2026-07-09T00:00:00Z'),
  ];
  const result = partitionRequests(rows, [profile('anna')], ME);
  expect(result.incoming.map(r => r.profile.userId)).toEqual(['anna']);
});

test('rows not involving the caller are ignored', () => {
  const rows = [row('anna', 'bo', '2026-07-10T00:00:00Z')];
  const result = partitionRequests(rows, [profile('anna'), profile('bo')], ME);
  expect(result.incoming).toEqual([]);
  expect(result.outgoing).toEqual([]);
});

test('empty input yields empty sides', () => {
  expect(partitionRequests([], [], ME)).toEqual({incoming: [], outgoing: []});
});
