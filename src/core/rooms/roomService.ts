/**
 * Rooms service — the only thing in the app that talks to Supabase for
 * multiplayer. Screens and the quiz store call these functions; the transport
 * (Supabase RPCs + realtime) stays hidden here.
 *
 * All writes go through SECURITY DEFINER RPCs (see
 * supabase/migrations/0001_rooms.sql); the client only ever reads via RLS.
 */
import {ensureSession, supabase} from '../supabase/client';
import type {ResultEntry} from '../stats/types';
import type {Deck, Room, RoomPlayer} from './types';

/** Thrown when a room feature is used but the backend isn't configured. */
export class BackendUnavailableError extends Error {
  constructor() {
    super('Backend not configured');
    this.name = 'BackendUnavailableError';
  }
}

/** Narrow the nullable client to a non-null one, after ensuring a session. */
async function requireClient() {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  await ensureSession();
  return supabase;
}

// Supabase returns snake_case rows; map them to our camelCase domain types.
function mapRoom(row: any): Room {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    gameType: row.game_type ?? 'quiz',
    topicIds: row.topic_ids ?? [],
    questionCount: row.question_count,
    questions: row.questions ?? null,
    currentIndex: row.current_index ?? 0,
    phase: row.phase ?? null,
    phaseDeadline: row.phase_deadline ?? null,
    createdAt: row.created_at,
  };
}

function mapPlayer(row: any): RoomPlayer {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    name: row.name,
    isHost: row.is_host,
    score: row.score ?? 0,
    joinedAt: row.joined_at,
  };
}

/** Host creates a room; the server mints the code and adds the host as a player. */
export async function createRoom(
  gameType: string,
  topicIds: string[],
  count: number,
  name: string,
): Promise<Room> {
  const client = await requireClient();
  const {data, error} = await client.rpc('create_room', {
    p_topic_ids: topicIds,
    p_count: count,
    p_name: name,
    p_game_type: gameType,
  });
  if (error) {
    throw error;
  }
  return mapRoom(Array.isArray(data) ? data[0] : data);
}

/** Guest joins an open lobby by code; throws if the code is unknown/closed. */
export async function joinRoom(code: string, name: string): Promise<Room> {
  const client = await requireClient();
  const {data, error} = await client.rpc('join_room', {
    p_code: code.trim().toUpperCase(),
    p_name: name,
  });
  if (error) {
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('Invalid or closed code');
  }
  return mapRoom(row);
}

export async function fetchRoom(roomId: string): Promise<Room | null> {
  const client = await requireClient();
  const {data, error} = await client
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapRoom(data) : null;
}

export async function fetchPlayers(roomId: string): Promise<RoomPlayer[]> {
  const client = await requireClient();
  const {data, error} = await client
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', {ascending: true});
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapPlayer);
}

/**
 * Live player roster for a room — fires on joins and score updates. Calls back
 * with the full, freshly-fetched list on every change. Returns an unsubscribe.
 */
export function subscribePlayers(
  roomId: string,
  cb: (players: RoomPlayer[]) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }
  const refresh = () => {
    fetchPlayers(roomId).then(cb).catch(() => {});
  };
  const channel = supabase
    .channel(`players:${roomId}`)
    .on(
      'postgres_changes',
      {event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}`},
      refresh,
    )
    .subscribe();
  // Prime with the current roster so callers don't wait for the first change.
  refresh();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/**
 * Live room row — used by guests to detect status → 'in_progress' and by every
 * device to follow the host's phase clock (M4). Primes with the current row so
 * subscribers get today's state, not just future changes.
 */
export function subscribeRoom(roomId: string, cb: (room: Room) => void): () => void {
  if (!supabase) {
    return () => {};
  }
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`},
      payload => cb(mapRoom(payload.new)),
    )
    .subscribe();
  // Deliver the current row immediately (postgres_changes only fires on change).
  fetchRoom(roomId)
    .then(room => {
      if (room) {
        cb(room);
      }
    })
    .catch(() => {});
  return () => {
    supabase?.removeChannel(channel);
  };
}

/** Host starts the game: stores the shared deck and flips status. */
export async function startGame(roomId: string, deck: Deck): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('start_game', {
    p_room_id: roomId,
    p_questions: deck,
  });
  if (error) {
    throw error;
  }
}

/** Push the caller's cumulative score so other devices see real standings. */
export async function updateScore(roomId: string, score: number): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('update_score', {
    p_room_id: roomId,
    p_score: score,
  });
  if (error) {
    throw error;
  }
}

/**
 * Host only — advance the synced round to a phase/question with an absolute
 * deadline the clients count down to (M4).
 */
export async function setPhase(
  roomId: string,
  phase: string,
  index: number,
  deadlineTs: number,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('set_phase', {
    p_room_id: roomId,
    p_phase: phase,
    p_index: index,
    p_deadline: new Date(deadlineTs).toISOString(),
  });
  if (error) {
    throw error;
  }
}

/**
 * Host only — replay a finished room: swap in a fresh deck, rewind the loop and
 * zero every player's score. Guests follow the room back into the game via the
 * same Realtime path as start_game.
 */
export async function restartGame(roomId: string, deck: Deck): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('restart_game', {
    p_room_id: roomId,
    p_questions: deck,
  });
  if (error) {
    throw error;
  }
}

/**
 * Host only — mark the game finished after the last standings, and persist each
 * player's final result (M5). The host is the only device with the authoritative
 * full standings, so it writes everyone's row in one idempotent RPC call.
 */
export async function finishGame(
  roomId: string,
  results: ResultEntry[],
  gameType: string = 'quiz',
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('finish_game', {
    p_room_id: roomId,
    p_results: results,
    p_game_type: gameType,
  });
  if (error) {
    throw error;
  }
}
