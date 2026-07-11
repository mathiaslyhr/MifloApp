/**
 * Pure logic behind the Friends tab's smart search: one field both filters
 * the existing friend list (name substring or exact code) and decides when
 * the query spells a friend code worth offering a "send request" action for.
 */
import type {SocialProfile} from './types';

type HasProfile = {profile: SocialProfile};

export function normalizeCode(query: string): string {
  return query.trim().toUpperCase();
}

/**
 * The friend code a query spells, or null. Codes are 6 chars with at least
 * one letter AND one digit (gen_friend_code's alphabet guarantees the mix),
 * so a 6-letter name like "Martin" never reads as a code.
 */
export function looksLikeFriendCode(query: string): string | null {
  const code = normalizeCode(query);
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return null;
  }
  if (!/[A-Z]/.test(code) || !/[0-9]/.test(code)) {
    return null;
  }
  return code;
}

/** Case-insensitive name substring OR exact code match; empty query → all. */
export function filterFriends<T extends HasProfile>(
  items: T[],
  query: string,
): T[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return items;
  }
  const name = trimmed.toLowerCase();
  const code = normalizeCode(trimmed);
  return items.filter(
    item =>
      item.profile.displayName.toLowerCase().includes(name) ||
      item.profile.friendCode === code,
  );
}

/**
 * The code to offer a friend request for, or null: the query must spell a
 * code no existing friend owns. Typing your OWN code is deliberately left to
 * the server's errorSelf answer — one code path instead of two.
 */
export function shouldOfferRequest<T extends HasProfile>(
  items: T[],
  query: string,
): string | null {
  const code = looksLikeFriendCode(query);
  if (code === null) {
    return null;
  }
  return items.some(item => item.profile.friendCode === code) ? null : code;
}
