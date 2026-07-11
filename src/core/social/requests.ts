/**
 * Pure join/partition logic for friend requests, kept out of socialService so
 * it can be unit-tested without a Supabase client: raw friend_requests rows +
 * the profiles they reference → {incoming, outgoing} for the Friends tab.
 */
import type {FriendRequest, FriendRequests, SocialProfile} from './types';

/** A raw friend_requests row as RLS hands it to us (participant-scoped). */
export type FriendRequestRow = {
  requester: string;
  addressee: string;
  createdAt: string;
};

/**
 * Split the caller's request rows by direction and attach the counterpart's
 * profile. Rows whose counterpart profile is missing are dropped (deleted
 * profile mid-flight); each side sorts newest first.
 */
export function partitionRequests(
  rows: FriendRequestRow[],
  profiles: SocialProfile[],
  uid: string,
): FriendRequests {
  const byId = new Map(profiles.map(p => [p.userId, p]));
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];
  for (const row of rows) {
    const counterpartId = row.addressee === uid ? row.requester : row.addressee;
    const profile = byId.get(counterpartId);
    if (!profile) {
      continue;
    }
    const request = {profile, createdAt: row.createdAt};
    if (row.addressee === uid) {
      incoming.push(request);
    } else if (row.requester === uid) {
      outgoing.push(request);
    }
  }
  const newestFirst = (a: FriendRequest, b: FriendRequest) =>
    b.createdAt.localeCompare(a.createdAt);
  incoming.sort(newestFirst);
  outgoing.sort(newestFirst);
  return {incoming, outgoing};
}
