-- Miflo M5: persist finished games as personal career stats.
--
-- Design notes:
--  * One row per (game, player). Results outlive the room (rooms get
--    TTL-cleaned in P3), so room_id is nullable with no hard FK and we snapshot
--    the room code, name, topics and counts at finish time.
--  * RLS is on: a device reads ONLY its own results (user_id = auth.uid()).
--    Career stats are strictly personal — no cross-player leaderboard here.
--  * No client INSERT policy. The host writes everyone's rows through the
--    finish_game RPC below (SECURITY DEFINER), same pattern as 0001/0002.

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists public.game_results (
  id             uuid primary key default gen_random_uuid(),
  -- Nullable, no FK: results must survive the room being deleted.
  room_id        uuid,
  room_code      text,
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  score          int not null,
  rank           int not null,
  is_winner      boolean not null default false,
  total_players  int not null,
  topic_ids      text[] not null default '{}',
  question_count int,
  played_at      timestamptz not null default now(),
  -- One result per player per game; makes the host write idempotent.
  unique (room_id, user_id)
);

create index if not exists game_results_user_id_idx
  on public.game_results (user_id, played_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.game_results enable row level security;

drop policy if exists game_results_select_own on public.game_results;
create policy game_results_select_own on public.game_results
  for select using (user_id = auth.uid());

-- ── Persist results when the host ends the game ───────────────────────────────
--
-- Replaces the 1-arg finish_game from 0002 with a 2-arg version that also writes
-- one game_results row per player. p_results is a JSON array of
-- {user_id, name, score, rank, is_winner}; room metadata is read from the room.

drop function if exists public.finish_game(uuid);

create or replace function public.finish_game(p_room_id uuid, p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_room   public.rooms;
  v_total  int;
begin
  update public.rooms
  set status = 'finished'
  where id = p_room_id and host_id = v_uid
  returning * into v_room;

  if not found then
    raise exception 'Only the host can finish the game';
  end if;

  v_total := coalesce(jsonb_array_length(p_results), 0);

  insert into public.game_results (
    room_id, room_code, user_id, name, score, rank, is_winner,
    total_players, topic_ids, question_count
  )
  select
    p_room_id,
    v_room.code,
    (r ->> 'user_id')::uuid,
    r ->> 'name',
    (r ->> 'score')::int,
    (r ->> 'rank')::int,
    coalesce((r ->> 'is_winner')::boolean, false),
    v_total,
    v_room.topic_ids,
    v_room.question_count
  from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) as r
  on conflict (room_id, user_id) do nothing;
end;
$$;

grant execute on function public.finish_game(uuid, jsonb) to authenticated;
