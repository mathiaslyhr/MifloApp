/**
 * friendSearch: the Friends tab's smart-search brain — name/code filtering
 * plus the "does this query spell a friend code?" decision that gates the
 * send-request offer card.
 */
import {
  filterFriends,
  looksLikeFriendCode,
  shouldOfferRequest,
} from '../friendSearch';
import type {SocialProfile} from '../types';

function friend(displayName: string, friendCode: string) {
  const profile: SocialProfile = {
    userId: `${displayName}-uuid`,
    displayName,
    friendCode,
    lastSeenAt: null,
    avatarPath: null,
  };
  return {profile};
}

const FRIENDS = [friend('Anna', 'AB12CD'), friend('Bo Madsen', 'QR7T2K')];

test('empty query keeps every friend', () => {
  expect(filterFriends(FRIENDS, '')).toEqual(FRIENDS);
  expect(filterFriends(FRIENDS, '   ')).toEqual(FRIENDS);
});

test('filters by case-insensitive name substring', () => {
  expect(filterFriends(FRIENDS, 'mad').map(f => f.profile.displayName)).toEqual(
    ['Bo Madsen'],
  );
  expect(filterFriends(FRIENDS, 'ANNA').map(f => f.profile.displayName)).toEqual(
    ['Anna'],
  );
});

test('filters by exact friend code, any casing', () => {
  expect(filterFriends(FRIENDS, 'qr7t2k').map(f => f.profile.displayName)).toEqual(
    ['Bo Madsen'],
  );
  // A partial code is not a name match either.
  expect(filterFriends(FRIENDS, 'QR7T2')).toEqual([]);
});

test('recognises codes: 6 alphanumerics with a letter AND a digit', () => {
  expect(looksLikeFriendCode('AB12CD')).toBe('AB12CD');
  expect(looksLikeFriendCode(' ab12cd ')).toBe('AB12CD');
  expect(looksLikeFriendCode('MARTIN')).toBeNull(); // no digit — a name
  expect(looksLikeFriendCode('123456')).toBeNull(); // no letter
  expect(looksLikeFriendCode('AB12C')).toBeNull(); // 5 chars
  expect(looksLikeFriendCode('AB12CDE')).toBeNull(); // 7 chars
  expect(looksLikeFriendCode('AB 2CD')).toBeNull(); // inner space
});

test('offers a request only for codes no existing friend owns', () => {
  expect(shouldOfferRequest(FRIENDS, 'ZZ99XY')).toBe('ZZ99XY');
  expect(shouldOfferRequest(FRIENDS, 'ab12cd')).toBeNull(); // already a friend
  expect(shouldOfferRequest(FRIENDS, 'Martin')).toBeNull(); // not a code
});
