/**
 * Social service — the only thing in the app that talks to Supabase for the
 * friends feature (profiles, friendships, published daily results). Like
 * roomService/statsService: reads go through RLS (own rows + friends' rows),
 * every write is a SECURITY DEFINER RPC keyed on auth.uid()
 * (supabase/migrations/0020_social.sql).
 *
 * The profile is cached in AsyncStorage so the tab renders instantly and the
 * outbox knows social is enabled without a network read. Identity is the anon
 * session: losing it (reinstall) orphans the profile — accepted for v1.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {decode as decodeBase64} from 'base64-arraybuffer';
import i18n from '../i18n';
import {BackendUnavailableError} from '../rooms/roomService';
import {ensureSession, supabase} from '../supabase/client';
import {partitionRequests, type FriendRequestRow} from './requests';
import type {DailyGame} from '../daily/dailyLog';
import type {
  DirectoryPerson,
  FriendFeed,
  FriendRequests,
  LeaderboardEntry,
  LeaderboardMe,
  LeaderboardView,
  PublicProfile,
  PublishedResult,
  SendRequestOutcome,
  SendRequestResult,
  SocialProfile,
} from './types';

const PROFILE_KEY = 'social.profile';

/** Narrow the nullable client to a non-null one, after ensuring a session. */
async function requireClient() {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  const uid = await ensureSession();
  if (!uid) {
    throw new BackendUnavailableError();
  }
  return {client: supabase, uid};
}

// Supabase returns snake_case rows; map them to our camelCase domain types.
function mapProfile(row: any): SocialProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    friendCode: row.friend_code,
    lastSeenAt: row.last_seen_at ?? null,
    avatarPath: row.avatar_path ?? null,
    favoritePlayerId: row.favorite_player_id ?? null,
    favoriteClubId: row.favorite_club_id ?? null,
    favoriteNation: row.favorite_nation ?? null,
  };
}

function mapResult(row: any): PublishedResult {
  return {
    dateKey: row.date_key,
    game: row.game,
    status: row.status,
    score: row.score ?? 0,
    total: row.total ?? null,
    streak: row.streak ?? 0,
  };
}

/** The locally cached profile, or null if this device hasn't opted in. */
export async function getCachedProfile(): Promise<SocialProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as SocialProfile) : null;
  } catch {
    return null;
  }
}

/**
 * The name this device plays under, in every room and every match: the
 * profile's display name, always. Never a generated one — see
 * core/identity/funnyName.ts for why that era ended.
 *
 * The cache is the answer in practice: App.tsx gates the whole navigator on a
 * cached profile, so a lobby cannot exist without one. The server read is the
 * cold-cache fallback and throws the same BackendUnavailableError that the room
 * create on the next line would throw anyway, so callers need no new catch.
 */
export async function myPlayerName(): Promise<string> {
  const cached = await getCachedProfile();
  if (cached) {
    return cached.displayName;
  }
  const remote = await fetchMyProfile();
  if (!remote) {
    // Unreachable behind the App.tsx gate: a session with no profile row. The
    // caller's existing error toast is the right answer — inventing a name here
    // is exactly the behaviour this function exists to end.
    throw new Error('No profile to play under');
  }
  return remote.displayName;
}

async function cacheProfile(profile: SocialProfile | null): Promise<void> {
  try {
    if (profile) {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } else {
      await AsyncStorage.removeItem(PROFILE_KEY);
    }
  } catch {
    // Cache only — the server row is the truth.
  }
}

/** This device's profile from the server (refreshes the cache), or null. */
export async function fetchMyProfile(): Promise<SocialProfile | null> {
  const {client, uid} = await requireClient();
  const {data, error} = await client
    .from('profiles')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const profile = data ? mapProfile(data) : null;
  await cacheProfile(profile);
  return profile;
}

/**
 * True when a create/rename failed because the display name is already taken
 * (case-insensitive). The RPCs raise `name_taken`; PostgREST surfaces it in
 * the error message, so the UI can offer a friendly retry instead of a generic
 * error. See 0027_unique_display_name.sql.
 */
export function isNameTakenError(err: unknown): boolean {
  const message = (err as {message?: string} | null)?.message;
  return typeof message === 'string' && message.includes('name_taken');
}

/**
 * Opt in: create the profile (server mints the permanent friend code). Safe
 * to retry — an existing profile is returned untouched, never renamed.
 */
export async function createProfile(displayName: string): Promise<SocialProfile> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('ensure_profile', {
    p_display_name: displayName,
  });
  if (error) {
    throw error;
  }
  const profile = mapProfile(Array.isArray(data) ? data[0] : data);
  await cacheProfile(profile);
  return profile;
}

export async function setDisplayName(name: string): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('set_display_name', {p_name: name});
  if (error) {
    throw error;
  }
  const cached = await getCachedProfile();
  if (cached) {
    await cacheProfile({...cached, displayName: name.trim()});
  }
}

/**
 * Set the caller's three showcase favorites (any of them null to clear) in one
 * RPC (0029_favorites.sql), then update the cached profile. Mirrors
 * setAvatarPath: the server row is the truth, the cache keeps the tab instant.
 */
export async function setFavorites(favorites: {
  playerId: string | null;
  clubId: string | null;
  nation: string | null;
}): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('set_favorites', {
    p_player: favorites.playerId,
    p_club: favorites.clubId,
    p_nation: favorites.nation,
  });
  if (error) {
    throw error;
  }
  const cached = await getCachedProfile();
  if (cached) {
    await cacheProfile({
      ...cached,
      favoritePlayerId: favorites.playerId,
      favoriteClubId: favorites.clubId,
      favoriteNation: favorites.nation,
    });
  }
}

/** The public bucket that stores profile pictures (0026_avatars.sql). */
const AVATAR_BUCKET = 'avatars';

/**
 * Upload a JPEG avatar (as base64 from the image picker) to the caller's
 * owner-scoped object and return the stored object key. Stable filename +
 * upsert so re-uploads overwrite; the display URL cache-busts (avatarUrlFor).
 *
 * The base64 → ArrayBuffer decode is deliberate: in bare React Native,
 * uploading a `fetch(uri).blob()` frequently writes a 0-byte/corrupt object,
 * so base64 is the only reliable upload body here.
 */
export async function uploadAvatar(base64: string): Promise<string> {
  const {client, uid} = await requireClient();
  const path = `${uid}/avatar.jpg`;
  const {error} = await client.storage
    .from(AVATAR_BUCKET)
    .upload(path, decodeBase64(base64), {contentType: 'image/jpeg', upsert: true});
  if (error) {
    throw error;
  }
  return path;
}

/** Point the caller's profile at an uploaded avatar object (or null to clear). */
export async function setAvatarPath(path: string | null): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('set_avatar_path', {p_path: path});
  if (error) {
    throw error;
  }
  const cached = await getCachedProfile();
  if (cached) {
    await cacheProfile({...cached, avatarPath: path});
  }
}

/**
 * Remove the caller's avatar: clear the profile pointer (the source of truth,
 * so it falls back to initials everywhere) then best-effort delete the storage
 * object. A delete failure is harmless — the pointer is already null.
 */
export async function clearAvatar(): Promise<void> {
  const {client, uid} = await requireClient();
  await setAvatarPath(null);
  await client.storage
    .from(AVATAR_BUCKET)
    .remove([`${uid}/avatar.jpg`])
    .catch(() => {});
}

/** Local preferences kept on account deletion (not "the user's data"). */
const PREFS_KEPT = new Set(['app.language', 'app.haptics']);

/**
 * Delete the account (App Store Guideline 5.1.1). Removes every server row keyed
 * to this device's anonymous identity — profile (which cascades friendships,
 * daily results and friend requests), push token, room memberships and the
 * avatar object — then signs out and wipes local data so the app returns to
 * first run. Language and haptics preferences are kept.
 */
export async function deleteAccount(): Promise<void> {
  const {client, uid} = await requireClient();
  // The RPC can't touch storage, so remove the avatar object here (the owner
  // holds the avatars_delete policy). Best-effort: a miss is harmless.
  await client.storage
    .from(AVATAR_BUCKET)
    .remove([`${uid}/avatar.jpg`])
    .catch(() => {});

  const {error} = await client.rpc('delete_my_account');
  if (error) {
    throw error;
  }

  // Drop the anonymous session (fresh identity next launch) and wipe local
  // user data. The server rows are already gone, so this is best-effort.
  await client.auth.signOut().catch(() => {});
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k => !PREFS_KEPT.has(k));
    await Promise.all(toRemove.map(k => AsyncStorage.removeItem(k)));
  } catch {
    // Local reset only — the account itself is already deleted.
  }
}

/**
 * Resolve a stored avatar object key to a displayable URL, or null for the
 * initials fallback. `bust` (a timestamp) appends a cache-buster so a fresh
 * upload isn't masked by the CDN's cache of the previous image at this key.
 */
export function avatarUrlFor(
  path: string | null | undefined,
  bust?: number,
): string | null {
  if (!path || !supabase) {
    return null;
  }
  const {publicUrl} = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data;
  return bust ? `${publicUrl}?v=${bust}` : publicUrl;
}

/** The server's jsonb status strings → our camelCase outcomes. */
const OUTCOME_BY_STATUS: Record<string, SendRequestOutcome> = {
  requested: 'requested',
  auto_accepted: 'autoAccepted',
  already_friends: 'alreadyFriends',
  already_requested: 'alreadyRequested',
};

/**
 * Ask to be friends with whoever owns `code`. Never instant anymore: the
 * server either files a pending request or, when the counterpart had already
 * asked us, fuses both into a friendship (`autoAccepted`). Throws with the
 * server's message on a bad code; classify with the helpers below.
 */
export async function sendFriendRequest(code: string): Promise<SendRequestResult> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('send_friend_request', {p_code: code});
  if (error) {
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as {status: string};
  return {
    outcome: OUTCOME_BY_STATUS[row.status] ?? 'requested',
    friend: mapProfile(row),
  };
}

/**
 * Ask to be friends with the roster player who owns `userId`. Same server logic
 * and outcomes as `sendFriendRequest`, but the target is resolved by uid — a
 * lobby player carries their uid, never a friend code (0033).
 */
export async function sendFriendRequestByUserId(
  userId: string,
): Promise<SendRequestResult> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('send_friend_request_by_userid', {
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as {status: string};
  return {
    outcome: OUTCOME_BY_STATUS[row.status] ?? 'requested',
    friend: mapProfile(row),
  };
}

/**
 * My pending requests, both directions, counterpart profiles attached
 * (the widened profiles_select from 0024 lets both ends read each other).
 */
export async function fetchFriendRequests(): Promise<FriendRequests> {
  const {client, uid} = await requireClient();
  const {data, error} = await client
    .from('friend_requests')
    .select('requester, addressee, created_at');
  if (error) {
    throw error;
  }
  const rows: FriendRequestRow[] = (data ?? []).map(row => ({
    requester: row.requester,
    addressee: row.addressee,
    createdAt: row.created_at,
  }));
  if (rows.length === 0) {
    return {incoming: [], outgoing: []};
  }
  const counterpartIds = [
    ...new Set(rows.map(r => (r.addressee === uid ? r.requester : r.addressee))),
  ];
  const {data: profileRows, error: profilesError} = await client
    .from('profiles')
    .select('*')
    .in('user_id', counterpartIds);
  if (profilesError) {
    throw profilesError;
  }
  return partitionRequests(rows, (profileRows ?? []).map(mapProfile), uid);
}

/** Accept the pending request from `userId` — the friendship exists after. */
export async function acceptFriendRequest(userId: string): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('accept_friend_request', {p_user_id: userId});
  if (error) {
    throw error;
  }
}

/** Decline the pending request from `userId`. Quiet: they are never told. */
export async function declineFriendRequest(userId: string): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('decline_friend_request', {p_user_id: userId});
  if (error) {
    throw error;
  }
}

export type FriendPushKind = 'friend_request' | 'request_accepted';

/**
 * Ring the counterpart's doorbell after a successful request/accept RPC. The
 * Edge Function re-verifies the state server-side, so this is safe to call
 * fire-and-forget (`.catch(() => {})`) — the Requests section is the source
 * of truth, the push is best-effort.
 */
export async function sendFriendPush(
  kind: FriendPushKind,
  toUserId: string,
): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.functions.invoke('send-friend-push', {
    body: {
      kind,
      toUserId,
      lang: i18n.language?.startsWith('da') ? 'da' : 'en',
    },
  });
  if (error) {
    throw error;
  }
}

/** True when sendFriendRequest failed because no profile carries that code. */
export function isUnknownCodeError(err: unknown): boolean {
  return String((err as Error)?.message ?? '').includes('Friend code not found');
}

/** True when the player typed their own code. */
export function isOwnCodeError(err: unknown): boolean {
  return String((err as Error)?.message ?? '').includes('your own code');
}

/** Presence heartbeat — a silent server no-op before the profile exists. */
export async function touchPresence(): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('touch_presence');
  if (error) {
    throw error;
  }
}

export async function removeFriend(userId: string): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('remove_friend', {p_user_id: userId});
  if (error) {
    throw error;
  }
}

/**
 * How many friends `userId` has — your own count or a friend's (the profile
 * pages' header line). Null when unknown: a stranger, the RPC not deployed
 * yet (0025), or a network failure — the caller hides the line, never errors.
 */
export async function fetchFriendCount(userId: string): Promise<number | null> {
  try {
    const {client} = await requireClient();
    const {data, error} = await client.rpc('friend_count', {p_user_id: userId});
    if (error) {
      return null;
    }
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Who `userId` is friends with (friends_of, 0043) — yourself or a friend. The
 * server rejects a stranger's list rather than returning an empty one, so this
 * throws for anyone you haven't earned; that's the caller's toast, not a
 * silently blank page.
 *
 * Each row carries YOUR relation to that person (`isFriend`), which is what
 * decides whether tapping opens their real profile or a stranger page.
 */
export async function fetchFriendsOf(userId: string): Promise<DirectoryPerson[]> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('friends_of', {p_user_id: userId});
  if (error) {
    throw error;
  }
  return ((data ?? []) as any[]).map(row => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    isFriend: row.is_friend === true,
  }));
}

/**
 * What anyone signed in may know about `userId` (public_profile, 0043): the
 * stranger page's whole world, and the authority on whether you're friends.
 * Null when the profile is gone (a deleted account), so the caller can say
 * "absent" rather than render an empty person.
 */
export async function fetchPublicProfile(
  userId: string,
): Promise<PublicProfile | null> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('public_profile', {p_user_id: userId});
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const row = data as any;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    favoritePlayerId: row.favorite_player_id ?? null,
    favoriteClubId: row.favorite_club_id ?? null,
    favoriteNation: row.favorite_nation ?? null,
    friendCount: typeof row.friend_count === 'number' ? row.friend_count : 0,
    isFriend: row.is_friend === true,
  };
}

/**
 * One friend's published results since `fromDateKey` (inclusive), newest
 * first — the friend-profile page's log. Readable through daily_results RLS
 * (own rows + friends' rows); like everything published, never an answer.
 */
export async function fetchFriendResults(
  userId: string,
  fromDateKey: string,
): Promise<PublishedResult[]> {
  const {client} = await requireClient();
  const {data, error} = await client
    .from('daily_results')
    .select('*')
    .eq('user_id', userId)
    .gte('date_key', fromDateKey)
    .order('date_key', {ascending: false});
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapResult);
}

/**
 * All friends with their published results since `fromDateKey` (inclusive),
 * friends alphabetically, each friend's results newest first. Friends who
 * haven't played recently still appear (empty results).
 */
export async function fetchFriendsFeed(fromDateKey: string): Promise<FriendFeed[]> {
  const {client, uid} = await requireClient();

  const {data: pairs, error: pairsError} = await client
    .from('friendships')
    .select('user_a, user_b');
  if (pairsError) {
    throw pairsError;
  }
  const friendIds = (pairs ?? []).map(row =>
    row.user_a === uid ? row.user_b : row.user_a,
  );
  if (friendIds.length === 0) {
    return [];
  }

  const [profilesRes, resultsRes] = await Promise.all([
    client.from('profiles').select('*').in('user_id', friendIds),
    client
      .from('daily_results')
      .select('*')
      .in('user_id', friendIds)
      .gte('date_key', fromDateKey)
      .order('date_key', {ascending: false}),
  ]);
  if (profilesRes.error) {
    throw profilesRes.error;
  }
  if (resultsRes.error) {
    throw resultsRes.error;
  }

  const byUser = new Map<string, PublishedResult[]>();
  for (const row of resultsRes.data ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(mapResult(row));
    byUser.set(row.user_id, list);
  }

  return (profilesRes.data ?? [])
    .map(row => ({
      profile: mapProfile(row),
      results: byUser.get(row.user_id) ?? [],
    }))
    .sort((a, b) => a.profile.displayName.localeCompare(b.profile.displayName));
}

// The worldwide board's snake_case rows → camelCase. Server guarantees the
// shape (worldwide_leaderboard, 0030), so this is a straight rename.
function mapLeaderboardRow(row: any): LeaderboardEntry {
  return {
    rank: row.rank,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    status: row.status,
    score: row.score ?? 0,
    total: row.total ?? 0,
    isMe: row.is_me ?? false,
  };
}

/**
 * The worldwide board for one daily game on one day: the top players plus the
 * caller's own rank (for pinning when outside the top slice). Unlike the friend
 * feeds this bypasses the friend-scoped RLS via the SECURITY DEFINER RPC, so a
 * stranger's name and avatar are visible — the public board is the point. Never
 * an answer, same as everything published.
 */
export async function fetchWorldwideLeaderboard(
  dateKey: string,
  game: DailyGame,
): Promise<LeaderboardView> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('worldwide_leaderboard', {
    p_date_key: dateKey,
    p_game: game,
    // Top 10 only; the caller's own rank rides back in `me` for pinning below.
    p_limit: 10,
  });
  if (error) {
    throw error;
  }
  const payload = (data ?? {}) as {rows?: any[]; me?: any};
  return {
    rows: (payload.rows ?? []).map(mapLeaderboardRow),
    me: payload.me
      ? ({
          rank: payload.me.rank,
          status: payload.me.status,
          score: payload.me.score ?? 0,
          total: payload.me.total ?? 0,
        } as LeaderboardMe)
      : null,
  };
}

/** All friends' profiles, alphabetical — the invite sheet's cut of the feed
 * (no daily_results round trip). */
export async function fetchFriends(): Promise<SocialProfile[]> {
  const {client, uid} = await requireClient();
  const {data: pairs, error: pairsError} = await client
    .from('friendships')
    .select('user_a, user_b');
  if (pairsError) {
    throw pairsError;
  }
  const friendIds = (pairs ?? []).map(row =>
    row.user_a === uid ? row.user_b : row.user_a,
  );
  if (friendIds.length === 0) {
    return [];
  }
  const {data, error} = await client
    .from('profiles')
    .select('*')
    .in('user_id', friendIds);
  if (error) {
    throw error;
  }
  return (data ?? [])
    .map(mapProfile)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Which of my friends can receive an invite push. Existence only — tokens
 * themselves are unreadable by clients (0023_push_tokens.sql). */
export async function fetchReachableFriendIds(): Promise<Set<string>> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('get_reachable_friends');
  if (error) {
    throw error;
  }
  return new Set(((data ?? []) as Array<{user_id: string}>).map(r => r.user_id));
}

/** Upload this device's APNs token so friends' invites can reach it. */
export async function uploadPushToken(token: string): Promise<void> {
  const {client} = await requireClient();
  const {error} = await client.rpc('set_push_token', {p_token: token});
  if (error) {
    throw error;
  }
}

/** Expected (non-throwing) outcomes of a party-invite push. */
export type InviteSendResult = {
  ok: boolean;
  reason?: 'no_token' | 'not_friends' | 'no_room' | 'apns_failed';
};

/**
 * Push "come join my party" to a friend's iPhone. The Edge Function
 * re-verifies everything server-side (friendship, live lobby, membership);
 * expected failures come back as `{ok:false, reason}` instead of throwing.
 */
export async function sendPartyInvite(
  friendUserId: string,
  code: string,
): Promise<InviteSendResult> {
  const {client} = await requireClient();
  const {data, error} = await client.functions.invoke('send-party-invite', {
    body: {
      friendUserId,
      code,
      lang: i18n.language?.startsWith('da') ? 'da' : 'en',
    },
  });
  if (error) {
    throw error;
  }
  return (data ?? {ok: false, reason: 'apns_failed'}) as InviteSendResult;
}

/** Batch upsert of this device's results (finish, outbox flush, backfill). */
export async function publishResults(entries: PublishedResult[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  const {client} = await requireClient();
  const {error} = await client.rpc('publish_daily_results', {
    p_results: entries.map(e => ({
      date_key: e.dateKey,
      game: e.game,
      status: e.status,
      score: e.score,
      total: e.total,
      streak: e.streak,
    })),
  });
  if (error) {
    throw error;
  }
}
