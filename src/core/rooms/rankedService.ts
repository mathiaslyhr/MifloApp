/**
 * Ranked Hattrick client wrappers — the SECURITY DEFINER RPCs from migration
 * 0034 (the authority) plus the own-row rating reads. Mirrors roomService's
 * shape (requireClient + supabase.rpc). Lock/clock/scoring are server-decided;
 * these are thin calls.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ensureSession, supabase} from '../supabase/client';
import {BackendUnavailableError} from './roomService';
import {VALUE_START} from '../../games/ranked-hattrick/constants';
import {EMPTY_HISTORY, historyFrom} from '../../games/ranked-hattrick/history';
import type {MyHistory} from '../../games/ranked-hattrick/history';
import type {RankedState} from '../../games/ranked-hattrick/types';

async function requireClient() {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  await ensureSession();
  return supabase;
}

/** Enter matchmaking. Returns a roomId if paired immediately, else null (queued). */
export async function findMatch(name: string): Promise<string | null> {
  const client = await requireClient();
  const {data, error} = await client.rpc('rh_find_match', {p_name: name});
  if (error) {
    throw error;
  }
  return (data as string | null) ?? null;
}

/** Read my queue row's assigned room (poll fallback for the pairing echo). */
export async function fetchQueueRoom(): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  const uid = await ensureSession();
  if (!uid) {
    return null;
  }
  const {data} = await supabase
    .from('ranked_queue')
    .select('room_id')
    .eq('user_id', uid)
    .maybeSingle();
  return (data as {room_id?: string} | null)?.room_id ?? null;
}

/** Leave the matchmaking queue. */
export async function cancelQueue(): Promise<void> {
  if (!supabase) {
    return;
  }
  await ensureSession();
  await supabase.rpc('rh_cancel_queue');
}

/** Watch this user's queue row; fires with the roomId once they're paired. */
export function subscribeQueue(
  userId: string,
  onRoom: (roomId: string) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }
  const channel = supabase
    .channel(`ranked_queue:${userId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {event: '*', schema: 'public', table: 'ranked_queue', filter: `user_id=eq.${userId}`},
      payload => {
        const roomId = (payload.new as {room_id?: string} | null)?.room_id;
        if (roomId) {
          onRoom(roomId);
        }
      },
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/** Host starts the match; the server picks a fair random starter. */
export async function rhStart(roomId: string, state: RankedState): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rh_start', {p_room_id: roomId, p_state: state});
  if (error) {
    throw error;
  }
}

/** Play the turn: a correct pick claims the cell, else it's a miss. */
export async function rhMove(
  roomId: string,
  cell: number,
  footballerId: string | undefined,
  correct: boolean,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rh_move', {
    p_room_id: roomId,
    p_cell: cell,
    p_footballer_id: footballerId ?? null,
    p_correct: correct,
  });
  if (error) {
    throw error;
  }
}

/** Chess flag: end the match if the turn-holder's clock is spent. */
export async function rhFlag(roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rh_flag', {p_room_id: roomId});
  if (error) {
    throw error;
  }
}

/** Host writes the next board / decided-match state. */
export async function rhAdvance(roomId: string, state: RankedState): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rh_advance', {p_room_id: roomId, p_state: state});
  if (error) {
    throw error;
  }
}

/** Host applies ELO once the match is decided (idempotent per matchId). */
export async function rhFinish(
  matchId: string,
  roomId: string,
  winnerUserId: string,
  loserUserId: string,
  draw: boolean,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rh_finish', {
    p_match_id: matchId,
    p_room_id: roomId,
    p_winner: winnerUserId,
    p_loser: loserUserId,
    p_draw: draw,
  });
  if (error) {
    throw error;
  }
}

/** Surrender the match — the caller takes the loss (+ ELO). */
export async function rhForfeit(matchId: string, roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rh_forfeit', {
    p_match_id: matchId,
    p_room_id: roomId,
  });
  if (error) {
    throw error;
  }
}

/** Check in while in a live match — silence past ABANDON_MS loses it. */
export async function rhHeartbeat(roomId: string): Promise<void> {
  if (!supabase) {
    return;
  }
  await ensureSession();
  await supabase.rpc('rh_heartbeat', {p_room_id: roomId});
}

/** Claim the win when the opponent has gone silent (app killed/crashed). */
export async function rhClaimAbandon(matchId: string, roomId: string): Promise<void> {
  if (!supabase) {
    return;
  }
  await ensureSession();
  await supabase.rpc('rh_claim_abandon', {p_match_id: matchId, p_room_id: roomId});
}

/** Report an app-background; the server counts it and forfeits on the 3rd. */
export async function rhReportBlur(matchId: string, roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rh_report_blur', {
    p_match_id: matchId,
    p_room_id: roomId,
  });
  if (error) {
    throw error;
  }
}

export type MyValue = {
  value: number;
  games: number;
  /** The last 5 € swings, newest first. The sign is the result (win/loss/draw). */
  form: number[];
};

/** This user's Value (€), games played, and their last 5 € swings. */
export async function fetchMyValue(): Promise<MyValue> {
  const empty: MyValue = {value: VALUE_START, games: 0, form: []};
  if (!supabase) {
    return empty;
  }
  const uid = await ensureSession();
  if (!uid) {
    return empty;
  }
  const {data: row} = await supabase
    .from('player_ratings')
    .select('value,games')
    .eq('user_id', uid)
    .maybeSingle();
  const {data: events} = await supabase
    .from('rating_events')
    .select('delta')
    .eq('user_id', uid)
    .order('created_at', {ascending: false})
    .limit(5);
  return {
    value: (row as {value?: number} | null)?.value ?? VALUE_START,
    games: (row as {games?: number} | null)?.games ?? 0,
    form: (events ?? []).map(e => (e as {delta?: number}).delta ?? 0),
  };
}

/**
 * The Value this device last showed. Kept for two reasons: the card paints it
 * on the first frame instead of sitting empty until Supabase answers, and the
 * € it holds is what "did a match happen while we were away?" is measured
 * against — so the count-up fires for a real result and never for a reopen.
 */
const CACHE_KEY = 'miflo.ranked.value';

/** Mirrors the stored snapshot for this process, so a reopen costs no await. */
let memo: MyValue | null = null;

/** The cached Value if this process has already loaded it. Synchronous on
 * purpose: it seeds the first render, and a render can't await. */
export function peekCachedValue(): MyValue | null {
  return memo;
}

/** The cached Value, hitting the disk only on the first call of the process. */
export async function readCachedValue(): Promise<MyValue | null> {
  if (memo) {
    return memo;
  }
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw == null) {
      return null;
    }
    const p = JSON.parse(raw) as Partial<MyValue>;
    // Distrust the disk: a half-written or older shape paints a broken card.
    if (
      typeof p.value !== 'number' ||
      typeof p.games !== 'number' ||
      !Array.isArray(p.form)
    ) {
      return null;
    }
    memo = {
      value: p.value,
      games: p.games,
      form: p.form.filter((n): n is number => typeof n === 'number'),
    };
    return memo;
  } catch {
    return null;
  }
}

export async function writeCachedValue(v: MyValue): Promise<void> {
  memo = v; // in memory first: the next reopen shouldn't wait on the disk.
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(v));
  } catch {
    // A missed write just means one extra count-up next time. Not worth a toast.
  }
}

/**
 * This user's ranked match history: every match's opponent, result and € swing,
 * plus their career record. One RPC (0041) feeds the whole career page — the
 * chart, the record and the recent-matches list — so the Profile tab costs one
 * round trip, not three.
 */
export async function fetchMatchHistory(limit?: number): Promise<MyHistory> {
  if (!supabase) {
    return EMPTY_HISTORY;
  }
  const uid = await ensureSession();
  if (!uid) {
    return EMPTY_HISTORY;
  }
  const {data, error} = await supabase.rpc('rh_match_history', {
    p_limit: limit ?? null,
  });
  if (error) {
    throw error;
  }
  return historyFrom(data);
}

/** A friend's career: the same three things the own page reads, plus the €
 * standing that the own page takes straight from player_ratings (RLS keeps
 * that row unreadable from here, so the RPC carries it). */
export type FriendCareer = {
  /** Null when they have never been rated — no ranked match, no €. */
  value: number | null;
  history: MyHistory;
};

const EMPTY_CAREER: FriendCareer = {value: null, history: EMPTY_HISTORY};

/**
 * A friend's ranked career (rh_friend_career, 0042). Friend-gated server-side;
 * a non-friend gets an exception rather than an empty page. Nothing is cached:
 * the own career earns its disk cache by being opened constantly and needing a
 * curve on frame one, while a friend's page is a visit — one round trip, a
 * skeleton, done.
 */
export async function fetchFriendCareer(
  userId: string,
  limit?: number,
): Promise<FriendCareer> {
  if (!supabase) {
    return EMPTY_CAREER;
  }
  const uid = await ensureSession();
  if (!uid) {
    return EMPTY_CAREER;
  }
  const {data, error} = await supabase.rpc('rh_friend_career', {
    p_user_id: userId,
    p_limit: limit ?? null,
  });
  if (error) {
    throw error;
  }
  const value = (data as {value?: unknown} | null)?.value;
  return {
    value: typeof value === 'number' ? value : null,
    history: historyFrom(data),
  };
}

/** The history this device last showed. Same bargain as the Value cache above:
 * the chart paints a real curve on frame one instead of a shell, and the
 * network only ever corrects it. */
const HISTORY_KEY = 'miflo.ranked.history';

let historyMemo: MyHistory | null = null;

/** The cached history if this process has already loaded it. Synchronous on
 * purpose — it seeds the first render, and a render can't await. */
export function peekCachedHistory(): MyHistory | null {
  return historyMemo;
}

/** The cached history, hitting the disk only on the first call of the process. */
export async function readCachedHistory(): Promise<MyHistory | null> {
  if (historyMemo) {
    return historyMemo;
  }
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (raw == null) {
      return null;
    }
    // historyFrom already distrusts its input, so the disk gets parsed by the
    // same rules as the wire — an older shape yields an empty history, never a
    // broken chart.
    const parsed = historyFrom(JSON.parse(raw));
    historyMemo = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCachedHistory(h: MyHistory): Promise<void> {
  historyMemo = h;
  try {
    // Stored in the wire's shape, so readCachedHistory can reuse historyFrom.
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        matches: h.matches.map(m => ({
          match_id: m.matchId,
          created_at: m.at,
          delta: m.delta,
          value_after: m.valueAfter,
          result: m.result,
          opponent_id: m.opponent?.userId ?? null,
          opponent_name: m.opponent?.name ?? null,
          opponent_avatar: m.opponent?.avatarPath ?? null,
        })),
        record: h.record,
      }),
    );
  } catch {
    // A missed write costs one shell on the next cold open. Not worth a toast.
  }
}
