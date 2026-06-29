-- Miflo: record which kind of game each result came from.
--
-- game_results so far only ever held quiz games, so career stats can't tell a
-- quiz from a future 1v1 (or anything else). Add a game_type column and thread
-- it through finish_game so every stored result knows its game.
--
--  * Defaults to 'quiz' so existing rows stay valid.
--  * finish_game gains a defaulted p_game_type param — older 2-arg callers keep
--    working (the default fills in), new callers pass the real type.

-- ── Column ────────────────────────────────────────────────────────────────────

alter table public.game_results
  add column if not exists game_type text not null default 'quiz';

-- ── finish_game: now also stamps the game type ────────────────────────────────

drop function if exists public.finish_game(uuid, jsonb);

create or replace function public.finish_game(
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
    total_players, topic_ids, question_count, game_type
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
    v_room.question_count,
    coalesce(p_game_type, 'quiz')
  from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) as r
  on conflict (room_id, user_id) do nothing;
end;
$$;

grant execute on function public.finish_game(uuid, jsonb, text) to authenticated;
