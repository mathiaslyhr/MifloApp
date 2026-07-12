/**
 * Domain types for the Social tab: friends see each other's daily-game
 * results at score level only. The games' actual answers and guesses never
 * leave the device, so nothing in these shapes can spoil a puzzle.
 */
import type {DailyGame} from '../daily/dailyLog';

/**
 * One published day of one daily game — the normalized cross-game shape the
 * backend stores. Friends see the same right/wrong pair the Log tab shows:
 * `score` is the wrong count (misses, or non-winning guesses) and `total` is
 * the right count (found slots, or 1-on-a-win/0), so a friend's card mirrors
 * your own. `'ongoing'` rows are live started-but-unfinished games, republished
 * as the counts grow and replaced by the final row at finish. `total` reads
 * back null on pre-right-count rows. `streak` is the streak at publish time;
 * the UI only trusts it on today's row.
 */
export type PublishedResult = {
  dateKey: string;
  game: DailyGame;
  status: 'won' | 'revealed' | 'ongoing';
  score: number;
  total: number | null;
  streak: number;
};

/** A device's opted-in social identity — separate from party names. */
export type SocialProfile = {
  userId: string;
  displayName: string;
  friendCode: string;
  /** Server timestamp of the last presence heartbeat (ISO), or null. */
  lastSeenAt: string | null;
  /** Storage object key for the chosen profile picture, or null for initials. */
  avatarPath: string | null;
};

/** One friend's profile plus their recent published results, newest first. */
export type FriendFeed = {
  profile: SocialProfile;
  results: PublishedResult[];
};

/**
 * What sending a friend request actually did. Adding is ask-then-accept, but
 * the server folds the quiet cases into one call: a fresh request
 * (`requested`), the counterpart had already asked us so both requests fused
 * into a friendship (`autoAccepted`), or nothing changed (`alreadyRequested`,
 * `alreadyFriends`).
 */
export type SendRequestOutcome =
  | 'requested'
  | 'autoAccepted'
  | 'alreadyFriends'
  | 'alreadyRequested';

export type SendRequestResult = {
  outcome: SendRequestOutcome;
  /** The profile behind the code — for toasts and follow-up pushes. */
  friend: SocialProfile;
};

/** One pending request joined with the counterpart's profile. */
export type FriendRequest = {
  profile: SocialProfile;
  /** Server timestamp (ISO) — newest requests sort first. */
  createdAt: string;
};

/** The caller's pending requests, split by direction. */
export type FriendRequests = {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};
