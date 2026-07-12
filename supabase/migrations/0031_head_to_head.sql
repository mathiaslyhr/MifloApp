-- 0031: head-to-head — record finished ONLINE games, and let two friends see
-- the games they've played against each other.
--
-- game_results (0003/0004) already stores one row per (game, player) with
-- rank/is_winner/score/game_type, but nothing has ever written to it and it is
-- readable only by its owner. This migration adds the missing pieces:
--
--  1. match_id — a per-game-instance key. Rooms are reused across "Play again"
--     (same room_id), so keying results on room_id would collapse every rematch
--     in a room into one row. The client derives a stable id per game instance
--     (roomId + a hash of that game's random content), so each distinct game —
--     and each Red Card hand — is its own result. game_results' old
--     (room_id, user_id) unique is replaced by (match_id, user_id).
--
--  2. record_game_results — like the old finish_game, but it does NOT flip
--     rooms.status to 'finished'. The four online-game screens treat
--     status != 'in_progress' as "host left → leave", so flipping it would kick
--     everyone off the scoreboard and break Play again / Back to lobby.
--     Recording must be decoupled from the room lifecycle. It UPSERTs, so a
--     reconnect that re-records the same instance is harmless.
--
--  3. head_to_head — a friends-only, two-party self-join over game_results.
--     game_results RLS stays select-own (nobody else can read your rows); this
--     SECURITY DEFINER RPC is the single, deliberately narrow window: given a
--     friend, it returns only the games you BOTH played, with both sides'
--     score/rank/is_winner. Other players' results never leak.
--
-- The dead finish_game RPC (superseded, zero call sites, and incompatible with
-- the new key) is dropped.

-- ── match_id: per-instance key, replacing the room_id unique ───────────────────

alter table public.game_results
  add column if not exists match_id text;

-- The inline `unique (room_id, user_id)` from 0003 is auto-named this. Drop it
-- so a room can hold more than one game's results.
alter table public.game_results
  drop constraint if exists game_results_room_id_user_id_key;

create unique index if not exists game_results_match_user_idx
  on public.game_results (match_id, user_id);

-- ── Drop the dead finish_game (both historical signatures) ─────────────────────

drop function if exists public.finish_game(uuid);
drop function if exists public.finish_game(uuid, jsonb);
drop function if exists public.finish_game(uuid, jsonb, text);

-- ── record_game_results: persist results WITHOUT ending the room ───────────────
--
-- Host-gated (host_id = auth.uid()). p_results is the same
-- {user_id, name, score, rank, is_winner} array the old finish_game took, keyed
-- now by p_match_id. Upserts so a re-record (reconnect, or a later Red Card
-- hand pushing fresh scores under a new match_id) is safe.

create or replace function public.record_game_results(
  p_match_id  text,
  p_room_id   uuid,
  p_results   jsonb,
  p_game_type text default 'quiz'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.rooms;
  v_total int;
begin
  if coalesce(p_match_id, '') = '' then
    raise exception 'match_id is required';
  end if;

  -- Verify host without touching status: the room stays 'in_progress' so the
  -- scoreboard / Play again / Back to lobby flows are undisturbed.
  select * into v_room
  from public.rooms
  where id = p_room_id and host_id = v_uid;

  if not found then
    raise exception 'Only the host can record results';
  end if;

  v_total := coalesce(jsonb_array_length(p_results), 0);

  insert into public.game_results (
    match_id, room_id, room_code, user_id, name, score, rank, is_winner,
    total_players, topic_ids, question_count, game_type
  )
  select
    p_match_id,
    p_room_id,
    v_room.code,
    (r ->> 'user_id')::uuid,
    r ->> 'name',
    (r ->> 'score')::int,
    (r ->> 'rank')::int,
    coalesce((r ->> 'is_winner')::boolean, false),
    v_total,
    v_room.topic_ids,
    v_room.question_count,
    coalesce(p_game_type, 'quiz')
  from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) as r
  on conflict (match_id, user_id) do update
    set name          = excluded.name,
        score         = excluded.score,
        rank          = excluded.rank,
        is_winner     = excluded.is_winner,
        total_players = excluded.total_players,
        game_type     = excluded.game_type,
        played_at     = now();
end;
$$;

revoke execute on function public.record_game_results(text, uuid, jsonb, text) from public, anon;
grant execute on function public.record_game_results(text, uuid, jsonb, text) to authenticated;

-- ── head_to_head: the games two friends have played against each other ────────
--
-- Returns a JSON array, newest first:
--   [ { match_id, game_type, played_at, total_players,
--       mine:   {score, rank, is_winner},
--       theirs: {score, rank, is_winner} } … ]
-- Only rows where BOTH the caller and p_friend recorded a result for the same
-- match. Guarded by are_friends, so a stranger's id yields nothing.
create or replace function public.head_to_head(p_friend uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if p_friend is null or not public.are_friends(v_uid, p_friend) then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'match_id', me.match_id,
        'game_type', me.game_type,
        'played_at', me.played_at,
        'total_players', me.total_players,
        'mine', jsonb_build_object(
          'score', me.score, 'rank', me.rank, 'is_winner', me.is_winner
        ),
        'theirs', jsonb_build_object(
          'score', them.score, 'rank', them.rank, 'is_winner', them.is_winner
        )
      )
      order by me.played_at desc
    ),
    '[]'::jsonb
  )
  into v_out
  from public.game_results me
  join public.game_results them
    on them.match_id = me.match_id
   and them.user_id = p_friend
  where me.user_id = v_uid
    and me.match_id is not null;

  return v_out;
end;
$$;

revoke execute on function public.head_to_head(uuid) from public, anon;
grant execute on function public.head_to_head(uuid) to authenticated;
