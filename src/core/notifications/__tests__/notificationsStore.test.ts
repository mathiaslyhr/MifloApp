/**
 * @format
 */
import {mergeFeed, unreadCount} from '../notificationsStore';
import type {FriendRequest, PartyInvite} from '../../social/types';

const req = (name: string, at: string): FriendRequest => ({
  profile: {
    userId: `u-${name}`,
    displayName: name,
    friendCode: 'AAA111',
    lastSeenAt: at,
    avatarPath: null,
    favoritePlayerId: null,
    favoriteClubId: null,
    favoriteNation: null,
  },
  createdAt: at,
});

const inv = (name: string, at: string): PartyInvite => ({
  id: `i-${name}`,
  createdAt: at,
  profile: {userId: `u-${name}`, displayName: name, avatarPath: null},
  code: 'ABC123',
  joined: false,
  joinable: true,
});

describe('mergeFeed', () => {
  it('interleaves both sources newest first', () => {
    const items = mergeFeed(
      [req('Anna', '2026-07-16T09:00:00Z')],
      [inv('Lars', '2026-07-16T11:00:00Z'), inv('Sofie', '2026-07-16T08:00:00Z')],
    );
    expect(items.map(i => i.at)).toEqual([
      '2026-07-16T11:00:00Z',
      '2026-07-16T09:00:00Z',
      '2026-07-16T08:00:00Z',
    ]);
    expect(items.map(i => i.kind)).toEqual(['invite', 'friend-request', 'invite']);
  });

  it('is empty when both sources are', () => {
    expect(mergeFeed([], [])).toEqual([]);
  });

  it('survives one source being empty', () => {
    expect(mergeFeed([req('Anna', '2026-07-16T09:00:00Z')], [])).toHaveLength(1);
    expect(mergeFeed([], [inv('Lars', '2026-07-16T09:00:00Z')])).toHaveLength(1);
  });
});

describe('unreadCount', () => {
  const items = mergeFeed(
    [req('Anna', '2026-07-16T09:00:00Z')],
    [inv('Lars', '2026-07-16T11:00:00Z')],
  );

  it('counts everything when nothing has ever been read', () => {
    expect(unreadCount(items, null)).toBe(2);
  });

  it('counts only what is newer than the last read', () => {
    expect(unreadCount(items, '2026-07-16T10:00:00Z')).toBe(1);
  });

  it('counts nothing once read past the newest', () => {
    expect(unreadCount(items, '2026-07-16T12:00:00Z')).toBe(0);
  });

  it('treats an item exactly at lastReadAt as read', () => {
    // Ties go to read: reopening the screen must not resurrect a dot.
    expect(unreadCount(items, '2026-07-16T11:00:00Z')).toBe(0);
  });
});
