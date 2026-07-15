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
  /** Showcase favorites — stable dataset ids, resolved to art/names at render.
   * Null when unset. Visible to friends (profiles RLS exposes friends' rows). */
  favoritePlayerId: string | null;
  favoriteClubId: string | null;
  favoriteNation: string | null;
};

/**
 * One row in someone's friend list (friends_of, 0043). Deliberately thinner
 * than a SocialProfile: a list is a list, and a friend-of-friend's code,
 * presence and favourites are none of the browser's business until they open
 * the page. `isFriend` is the browser's own relation to this person, which is
 * what decides whether tapping opens a full profile or a stranger page.
 */
export type DirectoryPerson = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  isFriend: boolean;
};

/**
 * What anyone signed in may know about anyone else (public_profile, 0043) —
 * the stranger page's whole world. No friend code, no presence: those stay
 * friend-scoped. `isFriend` is the authority, re-asked on every visit, because
 * friendship can change between the tap and the fetch.
 */
export type PublicProfile = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  favoritePlayerId: string | null;
  favoriteClubId: string | null;
  favoriteNation: string | null;
  friendCount: number;
  isFriend: boolean;
};

/** One friend's profile plus their recent published results, newest first. */
export type FriendFeed = {
  profile: SocialProfile;
  results: PublishedResult[];
};

/**
 * One ranked player on the worldwide board for a single game+day. Only
 * finished days rank (won/revealed); `total` is the right count (higher is
 * better), `score` the tries/misses (lower is better). Public by design — a
 * display name and avatar, never a user id or an answer (worldwide_leaderboard,
 * 0030). `avatarPath` resolves through avatarUrlFor like every other avatar.
 */
export type LeaderboardEntry = {
  rank: number;
  displayName: string;
  avatarPath: string | null;
  status: 'won' | 'revealed';
  score: number;
  total: number;
  /** True for the caller's own row, so the UI can highlight it in the slice
   * without any user id crossing the wire. */
  isMe: boolean;
};

/** The caller's own ranked position, or null when they haven't finished today's
 * game (so nothing to pin). Shares the entry's score fields, minus identity. */
export type LeaderboardMe = {
  rank: number;
  status: 'won' | 'revealed';
  score: number;
  total: number;
};

/** A worldwide board: the top slice plus the caller's own row (for pinning when
 * it falls outside the slice). */
export type LeaderboardView = {
  rows: LeaderboardEntry[];
  me: LeaderboardMe | null;
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
