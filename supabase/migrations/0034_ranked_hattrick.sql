-- Miflo — Ranked Hattrick: server-arbitrated simultaneous locking, per-player
-- match clocks, and ELO. A DIFFERENT game from friendly (turn-based) Hattrick.
--
-- Design:
--  * The board/grid content is client-generated (the football dataset lives in
--    the app, not the DB), same trust model as friendly Hattrick + the answer
--    (row×col) check. What is SERVER-AUTHORITATIVE here is the part that decides
--    who wins: the lock race, the one-lock-per-player rule, the per-player clock
--    (burns only while holding a lock, 15s cap, OUT at 0), and ELO.
--  * Every mutating RPC takes `select game_state ... for update` so competing
--    tappers on the same room serialize — receipt order decides the race, a cell
--    can never be double-locked. now() is the authoritative clock.
--  * This plpgsql MIRRORS the pure TS resolver in
--    src/games/ranked-hattrick/engine.ts — keep the two in parity.
--
-- Constants (parity with src/games/ranked-hattrick/constants.ts):
--    LOCK_TIMEOUT_MS = 15000, ELO_K = 32, ELO_START = 1000.

-- ── Rating store ─────────────────────────────────────────────────────────────

create table if not exists public.player_ratings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  rating     int not null default 1000,
  games      int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.rating_events (
  id         uuid primary key default gen_random_uuid(),
  match_id   text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  delta      int not null,
  created_at timestamptz not null default now()
);
create index if not exists rating_events_user_idx
  on public.rating_events (user_id, created_at desc);

-- Once-only ELO guard: a match id inserts here exactly once.
create table if not exists public.ranked_elo_log (
  match_id   text primary key,
  applied_at timestamptz not null default now()
);

-- ── Matchmaking queue ────────────────────────────────────────────────────────

create table if not exists public.ranked_queue (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  rating      int not null default 1000,
  name        text not null,
  enqueued_at timestamptz not null default now(),
  room_id     uuid  -- null while waiting; filled when paired
);

-- ── RLS: own-row reads; all writes go through the SECURITY DEFINER RPCs ───────

alter table public.player_ratings enable row level security;
alter table public.rating_events  enable row level security;
alter table public.ranked_queue   enable row level security;
-- Internal idempotency guard: no policies at all, so no client can read/write
-- it; only the SECURITY DEFINER rh_finish (which bypasses RLS) touches it.
alter table public.ranked_elo_log enable row level security;

drop policy if exists player_ratings_select_own on public.player_ratings;
create policy player_ratings_select_own on public.player_ratings
  for select using (user_id = auth.uid());

drop policy if exists rating_events_select_own on public.rating_events;
create policy rating_events_select_own on public.rating_events
  for select using (user_id = auth.uid());

drop policy if exists ranked_queue_select_own on public.ranked_queue;
create policy ranked_queue_select_own on public.ranked_queue
  for select using (user_id = auth.uid());

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'ranked_queue'
  ) then
    alter publication supabase_realtime add table public.ranked_queue;
  end if;
end $$;

-- ── Pure helpers (mirror engine.ts) ──────────────────────────────────────────

-- Three-in-a-row → winner userId; full board with no line → 'dead'; else null.
create or replace function public.rh_board_winner(b jsonb)
returns text language plpgsql immutable as $$
declare
  lines int[][] := array[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  i int; a text; c1 text; c2 text; v_full boolean;
begin
  for i in 1..8 loop
    a  := b->(lines[i][1])->>'userId';
    c1 := b->(lines[i][2])->>'userId';
    c2 := b->(lines[i][3])->>'userId';
    if a is not null and a = c1 and a = c2 then
      return a;
    end if;
  end loop;
  select bool_and(elem <> 'null'::jsonb) into v_full from jsonb_array_elements(b) elem;
  if v_full then return 'dead'; end if;
  return null;
end; $$;

-- Release the lock on p_cell, burning the holder's clock (capped 15s and at
-- whatever remains). Empties the clock → OUT + a synced outOfTime beat.
create or replace function public.rh_burn(p_state jsonb, p_cell int, p_now bigint)
returns jsonb language plpgsql immutable as $$
declare
  s jsonb := p_state #- array['locks', p_cell::text];
  v_lock jsonb := p_state->'locks'->(p_cell::text);
  uid text; locked_at bigint; elapsed bigint; prev_rem bigint; new_rem bigint;
  was_out boolean; now_out boolean; v_seq int;
begin
  if v_lock is null then return s; end if;
  uid := v_lock->>'userId';
  locked_at := (v_lock->>'lockedAt')::bigint;
  elapsed := greatest(0, least(p_now - locked_at, 15000));
  prev_rem := (s->'clocks'->uid->>'remainingMs')::bigint;
  new_rem := greatest(0, prev_rem - elapsed);
  now_out := new_rem <= 0;
  was_out := (s->'clocks'->uid->>'out')::boolean;
  s := jsonb_set(s, array['clocks', uid],
        jsonb_build_object('remainingMs', new_rem, 'out', now_out), true);
  if now_out and not was_out then
    v_seq := coalesce((s->'beat'->>'seq')::int, 0) + 1;
    s := jsonb_set(s, array['beat'],
          jsonb_build_object('kind','outOfTime','userId',uid,'seq',v_seq), true);
  end if;
  return s;
end; $$;

-- Release every lock past the 15s cap or that has run its holder's clock to 0.
create or replace function public.rh_sweep(p_state jsonb, p_now bigint)
returns jsonb language plpgsql immutable as $$
declare
  s jsonb := p_state; rec record; uid text; locked_at bigint; elapsed bigint; remaining bigint;
begin
  for rec in select key, value from jsonb_each(p_state->'locks') loop
    uid := rec.value->>'userId';
    locked_at := (rec.value->>'lockedAt')::bigint;
    remaining := (s->'clocks'->uid->>'remainingMs')::bigint;
    elapsed := p_now - locked_at;
    if elapsed >= 15000 or elapsed >= remaining then
      s := public.rh_burn(s, rec.key::int, p_now);
    end if;
  end loop;
  return s;
end; $$;

create or replace function public._rh_save(p_room_id uuid, p_state jsonb)
returns void language sql security definer set search_path = public as $$
  update public.rooms set game_state = p_state where id = p_room_id;
$$;

-- ── The lock-race resolver ───────────────────────────────────────────────────

create or replace function public.rh_lock(p_room_id uuid, p_cell int)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_now  bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb;
  v_clock jsonb;
  v_held text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null then raise exception 'Game not in progress'; end if;

  v_state := public.rh_sweep(v_state, v_now);

  v_clock := v_state->'clocks'->(v_uid::text);
  if v_clock is null or (v_clock->>'out')::boolean then
    perform public._rh_save(p_room_id, v_state); return 'taken';
  end if;
  if v_state->>'matchWinner' is not null or v_state->>'boardWinner' is not null then
    perform public._rh_save(p_room_id, v_state); return 'taken';
  end if;
  select key into v_held from jsonb_each(v_state->'locks')
    where value->>'userId' = v_uid::text limit 1;
  if v_held is not null then
    perform public._rh_save(p_room_id, v_state); return 'taken';
  end if;
  if (v_state->'board'->p_cell) <> 'null'::jsonb or (v_state->'locks' ? p_cell::text) then
    perform public._rh_save(p_room_id, v_state); return 'taken';
  end if;

  v_state := jsonb_set(v_state, array['locks', p_cell::text],
    jsonb_build_object('userId', v_uid::text, 'lockedAt', v_now), true);
  perform public._rh_save(p_room_id, v_state);
  return 'granted';
end; $$;

-- ── Resolve a held lock: correct → claim + maybe score; else contestable miss ─

create or replace function public.rh_resolve(
  p_room_id uuid, p_cell int, p_outcome text, p_footballer_id text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_now  bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb; v_lock jsonb; v_board jsonb; v_bw text; v_scores jsonb;
  v_opp text; v_level boolean; v_seq int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null then raise exception 'Game not in progress'; end if;

  v_state := public.rh_sweep(v_state, v_now);
  v_lock := v_state->'locks'->(p_cell::text);
  if v_lock is null or v_lock->>'userId' <> v_uid::text then
    perform public._rh_save(p_room_id, v_state); return; -- no longer holds it
  end if;

  v_state := public.rh_burn(v_state, p_cell, v_now); -- release + burn clock

  if p_outcome = 'correct' and p_footballer_id is not null then
    v_board := jsonb_set(v_state->'board', array[p_cell::text],
      jsonb_build_object('userId', v_uid::text, 'footballerId', p_footballer_id), true);
    v_state := jsonb_set(v_state, array['board'], v_board, true);
    v_state := jsonb_set(v_state, array['usedFootballerIds'],
      (v_state->'usedFootballerIds') || to_jsonb(p_footballer_id), true);
    v_bw := public.rh_board_winner(v_board);
    if v_bw is not null and v_bw <> 'dead' then
      v_scores := v_state->'scores';
      v_scores := jsonb_set(v_scores, array[v_bw],
        to_jsonb(coalesce((v_scores->>v_bw)::int, 0) + 1), true);
      v_state := jsonb_set(v_state, array['scores'], v_scores, true);
      select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
        where p->>'userId' <> v_bw limit 1;
      v_level := v_opp is not null
        and (v_scores->>v_bw)::int = coalesce((v_scores->>v_opp)::int, 0);
      v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
      v_state := jsonb_set(v_state, array['beat'],
        jsonb_build_object('kind', case when v_level then 'level' else 'goal' end,
                           'userId', v_bw, 'seq', v_seq), true);
    end if;
    v_state := jsonb_set(v_state, array['boardWinner'], coalesce(to_jsonb(v_bw), 'null'::jsonb), true);
  end if;

  perform public._rh_save(p_room_id, v_state);
end; $$;

-- ── Host loads the next board / the decided-match state (content is trusted,
--    same as friendly Hattrick). Clock/score fields are preserved by the host. ─

create or replace function public.rh_advance(p_room_id uuid, p_state jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  update public.rooms set game_state = p_state
    where id = p_room_id and host_id = v_uid and status = 'in_progress';
  if not found then raise exception 'Only the host can advance'; end if;
end; $$;

-- ── ELO — host-gated, idempotent per match id ────────────────────────────────

create or replace function public.rh_finish(
  p_match_id text, p_room_id uuid, p_winner uuid, p_loser uuid, p_draw boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r_a int; r_b int; e_a numeric; s_a numeric; d int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.rooms where id = p_room_id and host_id = v_uid) then
    raise exception 'Only the host records the result';
  end if;

  insert into public.ranked_elo_log (match_id) values (p_match_id)
    on conflict (match_id) do nothing;
  if not found then return; end if; -- already applied

  -- A = p_winner (or either side on a draw), B = p_loser.
  select coalesce((select rating from public.player_ratings where user_id = p_winner), 1000) into r_a;
  select coalesce((select rating from public.player_ratings where user_id = p_loser),  1000) into r_b;
  e_a := 1.0 / (1.0 + power(10.0, (r_b - r_a) / 400.0));
  s_a := case when p_draw then 0.5 else 1.0 end;
  d := round(32 * (s_a - e_a))::int;

  insert into public.player_ratings (user_id, rating, games)
    values (p_winner, r_a + d, 1)
    on conflict (user_id) do update
    set rating = r_a + d, games = public.player_ratings.games + 1, updated_at = now();
  insert into public.player_ratings (user_id, rating, games)
    values (p_loser, r_b - d, 1)
    on conflict (user_id) do update
    set rating = r_b - d, games = public.player_ratings.games + 1, updated_at = now();

  insert into public.rating_events (match_id, user_id, delta) values
    (p_match_id, p_winner, d),
    (p_match_id, p_loser, -d);
end; $$;

-- ── Matchmaking: pair the closest-rating waiting player, else enqueue ─────────

create or replace function public.rh_find_match(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rating int;
  v_opp uuid; v_opp_name text;
  v_room uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_rating := coalesce((select rating from public.player_ratings where user_id = v_uid), 1000);

  -- Take the closest-rating waiting opponent (oldest as tiebreak), locked so two
  -- simultaneous searchers can't grab the same partner.
  select user_id, name into v_opp, v_opp_name
  from public.ranked_queue
  where room_id is null and user_id <> v_uid
  order by abs(rating - v_rating), enqueued_at
  limit 1
  for update skip locked;

  if v_opp is null then
    insert into public.ranked_queue (user_id, rating, name, enqueued_at, room_id)
    values (v_uid, v_rating, p_name, now(), null)
    on conflict (user_id) do update
    set rating = excluded.rating, name = excluded.name, enqueued_at = now(), room_id = null;
    return null;
  end if;

  insert into public.rooms (code, host_id, game_type, status)
    values (public.gen_code(), v_uid, 'ranked-hattrick', 'lobby')
    returning id into v_room;
  insert into public.players (room_id, user_id, name, is_host) values
    (v_room, v_uid, p_name, true),
    (v_room, v_opp, v_opp_name, false);
  update public.ranked_queue set room_id = v_room where user_id in (v_uid, v_opp);
  return v_room;
end; $$;

create or replace function public.rh_cancel_queue()
returns void language sql security definer set search_path = public as $$
  delete from public.ranked_queue where user_id = auth.uid();
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────

grant execute on function public.rh_lock(uuid, int) to authenticated;
grant execute on function public.rh_resolve(uuid, int, text, text) to authenticated;
grant execute on function public.rh_advance(uuid, jsonb) to authenticated;
grant execute on function public.rh_finish(text, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.rh_find_match(text) to authenticated;
grant execute on function public.rh_cancel_queue() to authenticated;
revoke execute on function public.rh_finish(text, uuid, uuid, uuid, boolean) from public, anon;
