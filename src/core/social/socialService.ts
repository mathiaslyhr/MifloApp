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
import {BackendUnavailableError} from '../rooms/roomService';
import {ensureSession, supabase} from '../supabase/client';
import type {FriendFeed, PublishedResult, SocialProfile} from './types';

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
 * Add a friend by their code — instantly mutual, idempotent. Throws with the
 * server's message on a bad code; classify with the helpers below.
 */
export async function addFriend(code: string): Promise<SocialProfile> {
  const {client} = await requireClient();
  const {data, error} = await client.rpc('add_friend', {p_code: code});
  if (error) {
    throw error;
  }
  return mapProfile(Array.isArray(data) ? data[0] : data);
}

/** True when addFriend failed because no profile carries that code. */
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
