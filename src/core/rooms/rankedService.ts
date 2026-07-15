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

/** The Value this device last showed, so the card can tell "a match happened"
 * from "they just opened the tab again" and only animate for the former. */
const LAST_SEEN_KEY = 'miflo.ranked.lastSeenValue';

export async function readLastSeenValue(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
    if (raw == null) {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function writeLastSeenValue(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, String(value));
  } catch {
    // A missed write just means one extra count-up next time. Not worth a toast.
  }
}
