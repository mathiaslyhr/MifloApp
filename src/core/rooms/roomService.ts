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
import {
  createHostHeartbeat,
  createStaleWatchdog,
  STALE_RETRY_MS,
  type StaleWatchdog,
} from './liveness';
import type {Deck, Room, RoomPlayer} from './types';

/** Thrown when a room feature is used but the backend isn't configured. */
export class BackendUnavailableError extends Error {
  constructor() {
    super('Backend not configured');
    this.name = 'BackendUnavailableError';
  }
}

/**
 * True when an error smells like "the request never reached the server", so
 * screens can say "check your connection" instead of blaming the input.
 * Covered shapes: RN fetch rejects with `TypeError: Network request failed`
 * (postgrest-js converts that to `{message: 'TypeError: Network request
 * failed', code: ''}`); auth-js throws `AuthRetryableFetchError` with
 * `status: 0` when `ensureSession` can't reach the server.
 */
export function isNetworkError(err: unknown): boolean {
  const e = err as {name?: string; message?: string; status?: number};
  if (e?.name === 'AuthRetryableFetchError' || e?.status === 0) {
    return true;
  }
  const msg = String(e?.message ?? '');
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.startsWith('AbortError')
  );
}

// Unique per subscription so two live channels for the same room never collide
// in supabase-js's topic-keyed registry (which returns the existing channel on
// a duplicate topic and would reject a second postgres_changes listener —
// crashing when both the Lobby and the game screen subscribe at once).
let channelSeq = 0;

/** Narrow the nullable client to a non-null one, after ensuring a session. */
async function requireClient() {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  await ensureSession();
  return supabase;
}

// Supabase returns snake_case rows; map them to our camelCase domain types.
// `host_last_seen` is deliberately NOT mapped: it's a liveness heartbeat, not
// room state, and leaving it out lets subscribeRoom drop heartbeat-only
// updates before they re-render screens.
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
    gameState: row.game_state ?? null,
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
    avatarPath: row.avatar_path ?? null,
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

/** A player renames their own row — room-scoped, for the round only. */
export async function renamePlayer(roomId: string, name: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('rename_player', {
    p_room_id: roomId,
    p_name: name,
  });
  if (error) {
    throw error;
  }
}

/** Host only — remove another player from the lobby (they're ejected client-side). */
export async function kickPlayer(roomId: string, userId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('kick_player', {
    p_room_id: roomId,
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
}

/** Host starts a turn-based board game from the lobby with its initial state. */
export async function startBoardGame(
  roomId: string,
  gameType: string,
  state: unknown,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('start_board_game', {
    p_room_id: roomId,
    p_game_type: gameType,
    p_state: state,
  });
  if (error) {
    throw error;
  }
}

/** Play a move — the server only accepts it if it's the caller's turn. */
export async function playMove(roomId: string, state: unknown): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('play_move', {
    p_room_id: roomId,
    p_state: state,
  });
  if (error) {
    throw error;
  }
}

/**
 * Any player proposes ending the game in a mutual tie. Unlike `playMove`, this
 * is allowed off-turn — the tie handshake in `0014_tie_offer.sql` handles the
 * side/offer bookkeeping server-side.
 */
export async function proposeTie(roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('propose_tie', {p_room_id: roomId});
  if (error) {
    throw error;
  }
}

/** Accept or decline a pending tie offer. All sides accepting ends the game. */
export async function respondTie(roomId: string, accept: boolean): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('respond_tie', {
    p_room_id: roomId,
    p_accept: accept,
  });
  if (error) {
    throw error;
  }
}

/** Host restarts the board game in place with fresh state (Play again). */
export async function restartBoardGame(
  roomId: string,
  state: unknown,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('restart_board_game', {
    p_room_id: roomId,
    p_state: state,
  });
  if (error) {
    throw error;
  }
}

// ── Red Card ─────────────────────────────────────────────────────
// Roles are assigned + the vote is tallied SERVER-SIDE (secrets never touch the
// broadcast state); see supabase/migrations/0015_footballer_imposter.sql.

/** The caller's private role — imposter (no footballer) or a detective with one. */
export type ImposterRoleResult =
  | {role: 'imposter'; footballerId: null}
  | {role: 'detective'; footballerId: string};

/**
 * Host starts a hand: the server privately picks the imposter + secret
 * footballer. `pool` is a batch of candidate footballer ids (the server picks
 * one, so the host never learns which); `rounds` is the host-picked question
 * count and `questionIds` the localizable questions to ask, one per round.
 */
export async function startRedCardGame(
  roomId: string,
  pool: string[],
  rounds: number,
  questionIds: string[],
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('start_red_card_game', {
    p_room_id: roomId,
    p_pool: pool,
    p_rounds: rounds,
    p_question_ids: questionIds,
  });
  if (error) {
    throw error;
  }
}

/** Host plays another hand (Play again) — new roles, running scores preserved. */
export async function restartRedCardGame(
  roomId: string,
  pool: string[],
  rounds: number,
  questionIds: string[],
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('restart_red_card_game', {
    p_room_id: roomId,
    p_pool: pool,
    p_rounds: rounds,
    p_question_ids: questionIds,
  });
  if (error) {
    throw error;
  }
}

/**
 * Submit (or, until the round resolves, safely resubmit) the caller's typed
 * answer for the current question round. The server hides answers until
 * everyone is in, then publishes them shuffled into the broadcast state.
 */
export async function submitRedCardAnswer(
  roomId: string,
  text: string,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('submit_red_card_answer', {
    p_room_id: roomId,
    p_text: text,
  });
  if (error) {
    throw error;
  }
}

/** Fetch ONLY the caller's own role. Null if the role isn't assigned yet. */
export async function getMyRedCardRole(
  roomId: string,
): Promise<ImposterRoleResult | null> {
  const client = await requireClient();
  const {data, error} = await client.rpc('get_my_red_card_role', {
    p_room_id: roomId,
  });
  if (error) {
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return null;
  }
  return {role: row.role, footballerId: row.footballer_id} as ImposterRoleResult;
}

/** Cast (or change) the caller's vote for the suspected imposter. */
export async function castRedCardVote(
  roomId: string,
  targetUserId: string,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('cast_red_card_vote', {
    p_room_id: roomId,
    p_target: targetUserId,
  });
  if (error) {
    throw error;
  }
}

/** A caught imposter's redemption guess at the secret footballer. */
export async function redCardGuess(
  roomId: string,
  footballerId: string,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('red_card_guess', {
    p_room_id: roomId,
    p_footballer: footballerId,
  });
  if (error) {
    throw error;
  }
}

// ── Offside ──────────────────────────────────────────────────────
// No secrets: the host builds the deck client-side and the whole game state is
// broadcast. The server verifies each answer against the stored deck and owns
// the score totals; see supabase/migrations/0017_offside.sql.

/**
 * Host starts a game: ships the host-built deck (see
 * src/games/offside/questions.ts). `rounds` must equal the deck length — the
 * generator can return fewer rounds than asked when the pool caps out.
 */
export async function startOffsideGame(
  roomId: string,
  deck: unknown[],
  rounds: number,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('start_offside_game', {
    p_room_id: roomId,
    p_deck: deck,
    p_rounds: rounds,
  });
  if (error) {
    throw error;
  }
}

/** Host plays again from the standings: fresh deck, everyone back to zero. */
export async function restartOffsideGame(
  roomId: string,
  deck: unknown[],
  rounds: number,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('restart_offside_game', {
    p_room_id: roomId,
    p_deck: deck,
    p_rounds: rounds,
  });
  if (error) {
    throw error;
  }
}

/**
 * Submit the caller's pick for round `round` (null = the timer ran out).
 * `points` is the client-computed speed score; the server re-verifies the pick
 * against the deck and clamps the range. Stale or duplicate submits are
 * silently ignored server-side, so timeout auto-submits never race the reveal.
 */
export async function submitOffsideAnswer(
  roomId: string,
  round: number,
  option: number | null,
  points: number,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('submit_offside_answer', {
    p_room_id: roomId,
    p_round: round,
    p_option: option,
    p_points: points,
  });
  if (error) {
    throw error;
  }
}

/**
 * Host resolves a question whose deadline has passed with answers still
 * missing (someone left or backgrounded). Idempotent once resolved.
 */
export async function forceOffsideReveal(roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('force_offside_reveal', {
    p_room_id: roomId,
  });
  if (error) {
    throw error;
  }
}

/** Host moves on from a reveal: next question, or standings after the last. */
export async function advanceOffsideRound(roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('advance_offside_round', {
    p_room_id: roomId,
  });
  if (error) {
    throw error;
  }
}

/** Host returns the party to the lobby (Back to lobby). */
export async function returnToLobby(roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('return_to_lobby', {p_room_id: roomId});
  if (error) {
    throw error;
  }
}

/**
 * Leave a party. Idempotent: a guest drops their own row; the host closes the
 * whole party (the room is deleted and players cascade). Safe to call when
 * already removed.
 */
export async function leaveRoom(roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('leave_room', {p_room_id: roomId});
  if (error) {
    throw error;
  }
}

/** Host liveness ping (see liveness.ts); a missed beat is never an error. */
export async function heartbeatRoom(roomId: string): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('heartbeat_room', {p_room_id: roomId});
  if (error) {
    throw error;
  }
}

/**
 * Ask the server to close a room whose host went silent. The server clock is
 * authoritative (0019_host_liveness.sql), so this is safe to call on
 * suspicion; returns true when the room was actually deleted.
 */
export async function closeStaleRoom(roomId: string): Promise<boolean> {
  const client = await requireClient();
  const {data, error} = await client.rpc('close_stale_room', {
    p_room_id: roomId,
  });
  if (error) {
    throw error;
  }
  return !!data;
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
 * Realtime channel health, forwarded to screens so they can tell the user when
 * live updates drop out. `CLOSED` also fires on a normal unsubscribe, so
 * listeners should ignore it.
 */
export type ChannelStatus =
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'CLOSED';

/**
 * Apply one realtime `players` change to an in-memory roster, preserving
 * fetchPlayers' join-time ordering. Returns the next roster, or null when the
 * payload can't be applied (caller should refetch). Pure and exported for
 * tests; DELETE payloads only carry the primary key, which is enough.
 */
export function applyRosterChange(
  roster: readonly RoomPlayer[],
  change: {eventType?: string; new?: any; old?: any},
): RoomPlayer[] | null {
  if (change.eventType === 'INSERT' || change.eventType === 'UPDATE') {
    if (!change.new?.id) {
      return null;
    }
    const incoming = mapPlayer(change.new);
    const next = roster.filter(p => p.id !== incoming.id);
    next.push(incoming);
    // ISO timestamps sort lexicographically; id tie-break keeps order stable.
    return next.sort((a, b) =>
      a.joinedAt === b.joinedAt
        ? a.id.localeCompare(b.id)
        : a.joinedAt < b.joinedAt
          ? -1
          : 1,
    );
  }
  if (change.eventType === 'DELETE') {
    if (!change.old?.id) {
      return null;
    }
    return roster.filter(p => p.id !== change.old.id);
  }
  return null;
}

/**
 * Live player roster for a room — fires on joins, leaves, and score updates.
 * Calls back with the full roster. Returns an unsubscribe.
 *
 * Changes are applied from the realtime payload itself (no refetch per
 * change); the full fetch runs only to prime the list and on every
 * (re-)`SUBSCRIBED`, so changes missed during an outage are recovered.
 * `onStatus` observes channel health.
 */
export function subscribePlayers(
  roomId: string,
  cb: (players: RoomPlayer[]) => void,
  onStatus?: (status: ChannelStatus, err?: Error) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }
  let roster: RoomPlayer[] = [];
  const refresh = () => {
    fetchPlayers(roomId)
      .then(players => {
        roster = players;
        cb(roster);
      })
      .catch(() => {});
  };
  const channel = supabase
    .channel(`players:${roomId}:${++channelSeq}`)
    .on(
      'postgres_changes',
      {event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}`},
      payload => {
        const next = applyRosterChange(roster, payload as any);
        if (next) {
          roster = next;
          cb(roster);
        } else {
          refresh();
        }
      },
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        refresh();
      }
      onStatus?.(status as ChannelStatus, err);
    });
  // Prime with the current roster so callers don't wait for the handshake.
  refresh();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/**
 * Live room row — used by guests to detect status → 'in_progress' and by every
 * device to follow the host's phase clock (M4). Primes with the current row so
 * subscribers get today's state, not just future changes.
 *
 * `onClosed` fires when the room row is deleted — i.e. the host left and the
 * party is over ("no host, no party"). Guests use it to return to the menu.
 * `selfIsHost` tells a returning host their own stale party was closed, so
 * screens can word the toast sensibly.
 *
 * `onStatus` observes channel health. Every (re-)`SUBSCRIBED` refetches the
 * row so updates missed during an outage are recovered — including a deleted
 * room, which can't replay as an event and instead surfaces via `onClosed`.
 *
 * Also runs the host-liveness protocol (liveness.ts): the host device beats
 * `heartbeat_room` while foregrounded; guest devices watch for the room to go
 * silent and then ask the server to close it (`close_stale_room`, server-clock
 * verified), which lands here as the same DELETE → `onClosed` path as an
 * explicit leave. `host_id` never changes, so the role is decided once.
 */
export function subscribeRoom(
  roomId: string,
  cb: (room: Room) => void,
  onClosed?: (info: {selfIsHost: boolean}) => void,
  onStatus?: (status: ChannelStatus, err?: Error) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }

  let userId: string | null = null;
  let hostId: string | null = null;
  let stopHeartbeat: (() => void) | null = null;
  let watchdog: StaleWatchdog | null = null;
  let lastStatus: ChannelStatus | null = null;
  // Last room signature delivered to `cb` — heartbeat_room only bumps the
  // unmapped host_last_seen column, so its UPDATE echoes map to an identical
  // Room and are dropped here instead of re-rendering screens every beat (and
  // possibly clobbering an in-flight optimistic move with a stale gameState).
  let lastSig: string | null = null;
  let closed = false;

  const disposeLiveness = () => {
    stopHeartbeat?.();
    stopHeartbeat = null;
    watchdog?.dispose();
    watchdog = null;
  };

  const closeOut = () => {
    if (closed) {
      return;
    }
    closed = true;
    disposeLiveness();
    onClosed?.({selfIsHost: hostId != null && hostId === userId});
  };

  const startLiveness = () => {
    if (closed || stopHeartbeat || watchdog || !userId || !hostId) {
      return;
    }
    if (userId === hostId) {
      stopHeartbeat = createHostHeartbeat(() => {
        heartbeatRoom(roomId).catch(() => {});
      });
    } else {
      watchdog = createStaleWatchdog(() => {
        // Our own channel is down: WE are the disconnected one, not the host.
        // Never accuse; check again once reconnected (re-SUBSCRIBED refresh
        // also pokes/ends this watchdog as appropriate).
        if (lastStatus !== 'SUBSCRIBED') {
          watchdog?.rearm(STALE_RETRY_MS);
          return;
        }
        closeStaleRoom(roomId)
          .then(wasClosed => {
            // Either way, resync: a deleted room surfaces via refresh() →
            // closeOut without relying on the DELETE event landing; a live
            // one repaints and the watchdog tries again later.
            refresh();
            if (!wasClosed) {
              watchdog?.rearm(STALE_RETRY_MS);
            }
          })
          .catch(() => {
            refresh();
            watchdog?.rearm(STALE_RETRY_MS);
          });
      });
    }
  };

  ensureSession()
    .then(id => {
      userId = id;
      startLiveness();
    })
    .catch(() => {});

  // Deliver the current row (postgres_changes only fires on change) — used to
  // prime on mount and to catch up after a reconnect.
  const refresh = () => {
    fetchRoom(roomId)
      .then(room => {
        if (room) {
          hostId = room.hostId;
          startLiveness();
          watchdog?.poke();
          lastSig = JSON.stringify(room);
          cb(room);
        } else {
          closeOut();
        }
      })
      .catch(() => {});
  };
  const channel = supabase
    .channel(`room:${roomId}:${++channelSeq}`)
    .on(
      'postgres_changes',
      {event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`},
      payload => {
        const room = mapRoom(payload.new);
        hostId = room.hostId;
        startLiveness();
        watchdog?.poke();
        const sig = JSON.stringify(room);
        if (sig !== lastSig) {
          lastSig = sig;
          cb(room);
        }
      },
    )
    .on(
      'postgres_changes',
      // DELETE carries only the primary key by default — that's all we need to
      // know the party closed. Filtering on `id` is valid because it's the PK.
      {event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`},
      () => closeOut(),
    )
    .subscribe((status, err) => {
      lastStatus = status as ChannelStatus;
      if (status === 'SUBSCRIBED') {
        refresh();
      }
      onStatus?.(status as ChannelStatus, err);
    });
  refresh();
  return () => {
    disposeLiveness();
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

// ── Cult Hero ────────────────────────────────────────────────────
// Picks stay hidden and rarity is scored SERVER-SIDE against the global answer
// stats; see supabase/migrations/0018_cult_hero.sql.

/**
 * Host starts a game: `prompts` is the host-built payload of prompt keys with
 * their eligible footballer ids + fame-prior pseudo-counts (see
 * src/games/cult-hero/famePrior.ts), one entry per round.
 */
export async function startCultHeroGame(
  roomId: string,
  rounds: number,
  prompts: unknown[],
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('start_cult_hero_game', {
    p_room_id: roomId,
    p_rounds: rounds,
    p_prompts: prompts,
  });
  if (error) {
    throw error;
  }
}

/** Host plays again (Play again) — fresh prompts, running scores preserved. */
export async function restartCultHeroGame(
  roomId: string,
  rounds: number,
  prompts: unknown[],
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('restart_cult_hero_game', {
    p_room_id: roomId,
    p_rounds: rounds,
    p_prompts: prompts,
  });
  if (error) {
    throw error;
  }
}

/**
 * Submit (or, until the round resolves, safely resubmit) the caller's pick for
 * the current prompt. The server hides picks until everyone is in, then scores
 * the round and publishes the results into the broadcast state.
 */
export async function submitCultHeroAnswer(
  roomId: string,
  footballerId: string,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('submit_cult_hero_answer', {
    p_room_id: roomId,
    p_footballer_id: footballerId,
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
 * Host only — persist each player's result for one finished game WITHOUT ending
 * the room (0031). Unlike the old finish_game, this leaves rooms.status =
 * 'in_progress', so the scoreboard, Play again and Back-to-lobby flows stay
 * intact — the four online games drive their end screens off game_state, not
 * status. `matchId` is a stable per-game-instance key (a room is reused across
 * Play again), so rematches record as distinct results; upserts server-side, so
 * re-calling for the same instance (a reconnect) is harmless. Only the host has
 * the authoritative full standings, so it writes everyone's row.
 */
export async function recordGameResults(
  matchId: string,
  roomId: string,
  results: ResultEntry[],
  gameType: string,
): Promise<void> {
  const client = await requireClient();
  const {error} = await client.rpc('record_game_results', {
    p_match_id: matchId,
    p_room_id: roomId,
    p_results: results,
    p_game_type: gameType,
  });
  if (error) {
    throw error;
  }
}
