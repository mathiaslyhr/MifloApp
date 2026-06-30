-- Miflo: make rooms multi-game aware.
--
-- Until now a room was implicitly a quiz: topic_ids/question_count are quiz
-- concepts and there was no record of which game a room runs. Odd One Out and
-- Missing XI reuse the same room/lobby/realtime machinery, so a room needs to
-- declare its game, and the quiz-only columns become optional.
--
--  * game_type defaults to 'quiz' → existing rooms and any in-flight client
--    that doesn't send it keep working. The change is backward compatible, so
--    the quiz keeps running during rollout.
--  * topic_ids/question_count lose NOT NULL — new games don't use them. The
--    shared deck still lives in `questions` (jsonb), which already holds any
--    game's deck format.
--  * create_room gains a defaulted p_game_type param — older 3-arg callers keep
--    working (the default fills in), new callers pass the real type.
--
-- start_game/restart_game are unchanged: they only swap the jsonb deck, which is
-- already game-agnostic.

-- ── Column + relaxed constraints ──────────────────────────────────────────────

alter table public.rooms
  add column if not exists game_type text not null default 'quiz';

alter table public.rooms alter column topic_ids drop not null;
alter table public.rooms alter column question_count drop not null;

-- ── create_room: now stamps the game type ─────────────────────────────────────

drop function if exists public.create_room(text[], int, text);

create or replace function public.create_room(
  p_topic_ids text[],
  p_count int,
  p_name text,
  p_game_type text default 'quiz'
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.rooms (code, host_id, topic_ids, question_count, game_type)
  values (
    public.gen_code(),
    v_uid,
    coalesce(p_topic_ids, '{}'),
    coalesce(p_count, 10),
    coalesce(p_game_type, 'quiz')
  )
  returning * into v_room;

  insert into public.players (room_id, user_id, name, is_host)
  values (v_room.id, v_uid, p_name, true);

  return v_room;
end;
$$;

grant execute on function public.create_room(text[], int, text, text) to authenticated;
