-- Miflo — Ranked Hattrick polish: forfeit (surrender), anti-cheat backgrounding
-- (3-strike, server-enforced), and answer-time telemetry. Builds on 0034; keep
-- the plpgsql in parity with the pure TS engine.

-- ── Answer-time telemetry (tuning LOCK_TIMEOUT + anomaly review) ──────────────

create table if not exists public.ranked_answer_log (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  cell       int not null,
  correct    boolean not null,
  ms         bigint not null,     -- held time from lock to resolve
  created_at timestamptz not null default now()
);
create index if not exists ranked_answer_log_user_idx
  on public.ranked_answer_log (user_id, created_at desc);

alter table public.ranked_answer_log enable row level security;
drop policy if exists ranked_answer_log_select_own on public.ranked_answer_log;
create policy ranked_answer_log_select_own on public.ranked_answer_log
  for select using (user_id = auth.uid());
grant select on public.ranked_answer_log to authenticated;

-- ── Shared: end the match with p_loser as the loser (forfeit / kick) ─────────
-- Internal only (revoked from clients): the caller passes an arbitrary loser, so
-- it must never be directly callable. rh_forfeit / rh_report_blur validate the
-- caller and pass their own id.

create or replace function public.rh_apply_loss(
  p_room_id uuid, p_match_id text, p_loser uuid
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb; v_opp text; v_seq int; r_a int; r_b int; e_a numeric; d int;
begin
  select game_state into v_state from public.rooms where id = p_room_id for update;
  if v_state is null or v_state->>'matchWinner' is not null then
    return; -- already decided
  end if;
  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> p_loser::text limit 1;
  if v_opp is null then return; end if;

  v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
  v_state := jsonb_set(v_state, array['matchWinner'], to_jsonb(v_opp), true);
  v_state := jsonb_set(v_state, array['beat'],
    jsonb_build_object('kind','winner','userId',v_opp,'seq',v_seq), true);
  update public.rooms set game_state = v_state where id = p_room_id;

  -- ELO, once per match id.
  insert into public.ranked_elo_log (match_id) values (p_match_id)
    on conflict (match_id) do nothing;
  if not found then return; end if;
  select coalesce((select rating from public.player_ratings where user_id = v_opp::uuid), 1000) into r_a;
  select coalesce((select rating from public.player_ratings where user_id = p_loser), 1000) into r_b;
  e_a := 1.0 / (1.0 + power(10.0, (r_b - r_a) / 400.0));
  d := round(32 * (1.0 - e_a))::int;
  insert into public.player_ratings (user_id, rating, games) values (v_opp::uuid, r_a + d, 1)
    on conflict (user_id) do update
    set rating = r_a + d, games = public.player_ratings.games + 1, updated_at = now();
  insert into public.player_ratings (user_id, rating, games) values (p_loser, r_b - d, 1)
    on conflict (user_id) do update
    set rating = r_b - d, games = public.player_ratings.games + 1, updated_at = now();
  insert into public.rating_events (match_id, user_id, delta) values
    (p_match_id, v_opp::uuid, d), (p_match_id, p_loser, -d);
end; $$;

revoke execute on function public.rh_apply_loss(uuid, text, uuid) from public, anon, authenticated;

-- ── Surrender: the caller forfeits the match ─────────────────────────────────

create or replace function public.rh_forfeit(p_match_id text, p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.players where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'Not a player in this match';
  end if;
  perform public.rh_apply_loss(p_room_id, p_match_id, v_uid);
end; $$;

-- ── Anti-cheat: report an app-background; 3rd strike forfeits the caller ──────

create or replace function public.rh_report_blur(p_match_id text, p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_state jsonb; v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null or v_state->>'matchWinner' is not null then return; end if;
  if not exists (
    select 1 from public.players where room_id = p_room_id and user_id = v_uid
  ) then
    return;
  end if;
  -- Ensure the blurs object exists, then bump this player's count.
  v_state := jsonb_set(v_state, '{blurs}', coalesce(v_state->'blurs', '{}'::jsonb), true);
  v_count := coalesce((v_state->'blurs'->>v_uid::text)::int, 0) + 1;
  v_state := jsonb_set(v_state, array['blurs', v_uid::text], to_jsonb(v_count), true);
  update public.rooms set game_state = v_state where id = p_room_id;
  -- 3rd strike → auto-forfeit (server-enforced, hacked-client-proof).
  if v_count >= 3 then
    perform public.rh_apply_loss(p_room_id, p_match_id, v_uid);
  end if;
end; $$;

-- ── Replace rh_resolve to also log answer times ──────────────────────────────

create or replace function public.rh_resolve(
  p_room_id uuid, p_cell int, p_outcome text, p_footballer_id text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_now  bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb; v_lock jsonb; v_board jsonb; v_bw text; v_scores jsonb;
  v_opp text; v_level boolean; v_seq int; v_elapsed bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null then raise exception 'Game not in progress'; end if;

  v_state := public.rh_sweep(v_state, v_now);
  v_lock := v_state->'locks'->(p_cell::text);
  if v_lock is null or v_lock->>'userId' <> v_uid::text then
    perform public._rh_save(p_room_id, v_state); return;
  end if;

  -- Answer-time telemetry (raw held time), for tuning + anomaly review.
  v_elapsed := v_now - (v_lock->>'lockedAt')::bigint;
  insert into public.ranked_answer_log (room_id, user_id, cell, correct, ms)
    values (p_room_id, v_uid, p_cell, p_outcome = 'correct', v_elapsed);

  v_state := public.rh_burn(v_state, p_cell, v_now);

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

grant execute on function public.rh_forfeit(text, uuid) to authenticated;
grant execute on function public.rh_report_blur(text, uuid) to authenticated;
