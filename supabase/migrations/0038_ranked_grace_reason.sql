-- Miflo — Ranked polish:
--  * TURN GRACE: the first 15s of a turn are free (read/tap/search/type); only
--    time beyond it burns the clock. Cheat-proof — computed from turnStartedAt.
--  * END REASON: why the match ended (boards / timeout / surrender / left), so
--    the finish panel can explain itself.
--  * ABANDONMENT: clients heartbeat while in a live match; if a player goes
--    silent (app killed/crashed/offline) the opponent claims the win.
-- Mirrors src/games/ranked-hattrick/{engine.ts,constants.ts}.
-- Constants: TURN_GRACE_MS 15000, ABANDON_MS 20000.

-- ── Move: grace-adjusted charge + endReason on a flag ────────────────────────

create or replace function public.rh_move(
  p_room_id uuid, p_cell int, p_footballer_id text, p_correct boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb; v_opp text; v_raw bigint; v_spent bigint; v_rem bigint;
  v_board jsonb; v_bw text; v_scores jsonb; v_level boolean; v_seq int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null then raise exception 'Game not in progress'; end if;
  if v_state->>'matchWinner' is not null or v_state->>'boardWinner' is not null then return; end if;
  if v_state->>'turnUserId' <> v_uid::text then return; end if;

  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> v_uid::text limit 1;

  -- Raw turn time (telemetry) vs charged time (beyond the free grace).
  v_raw := greatest(0, v_now - (v_state->>'turnStartedAt')::bigint);
  v_spent := greatest(0, v_raw - 15000);
  v_rem := greatest(0, (v_state->'clocks'->(v_uid::text)->>'remainingMs')::bigint - v_spent);
  v_state := jsonb_set(v_state, array['clocks', v_uid::text],
    jsonb_build_object('remainingMs', v_rem, 'out', v_rem <= 0), true);
  insert into public.ranked_answer_log (room_id, user_id, cell, correct, ms)
    values (p_room_id, v_uid, p_cell, coalesce(p_correct, false), v_raw);

  if v_rem <= 0 and v_opp is not null then
    v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
    v_state := jsonb_set(v_state, '{matchWinner}', to_jsonb(v_opp), true);
    v_state := jsonb_set(v_state, '{endReason}', '"timeout"'::jsonb, true);
    v_state := jsonb_set(v_state, '{beat}',
      jsonb_build_object('kind','outOfTime','userId',v_uid::text,'seq',v_seq), true);
    perform public._rh_save(p_room_id, v_state); return;
  end if;

  if not coalesce(p_correct, false) or p_footballer_id is null then
    v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
    v_state := jsonb_set(v_state, '{turnUserId}', to_jsonb(coalesce(v_opp, v_uid::text)), true);
    v_state := jsonb_set(v_state, '{turnStartedAt}', to_jsonb(v_now), true);
    v_state := jsonb_set(v_state, '{beat}',
      jsonb_build_object('kind','missed','userId',v_uid::text,'seq',v_seq), true);
    perform public._rh_save(p_room_id, v_state); return;
  end if;

  v_board := jsonb_set(v_state->'board', array[p_cell::text],
    jsonb_build_object('userId', v_uid::text, 'footballerId', p_footballer_id), true);
  v_state := jsonb_set(v_state, '{board}', v_board, true);
  v_state := jsonb_set(v_state, '{usedFootballerIds}',
    (v_state->'usedFootballerIds') || to_jsonb(p_footballer_id), true);
  v_bw := public.rh_board_winner(v_board);
  if v_bw is not null and v_bw <> 'dead' then
    v_scores := v_state->'scores';
    v_scores := jsonb_set(v_scores, array[v_bw],
      to_jsonb(coalesce((v_scores->>v_bw)::int, 0) + 1), true);
    v_state := jsonb_set(v_state, '{scores}', v_scores, true);
    v_level := v_opp is not null and (v_scores->>v_bw)::int = coalesce((v_scores->>v_opp)::int, 0);
    v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
    v_state := jsonb_set(v_state, '{beat}',
      jsonb_build_object('kind', case when v_level then 'level' else 'goal' end,
                         'userId', v_bw, 'seq', v_seq), true);
  end if;
  v_state := jsonb_set(v_state, '{boardWinner}', coalesce(to_jsonb(v_bw), 'null'::jsonb), true);
  if v_bw is null then
    v_state := jsonb_set(v_state, '{turnUserId}', to_jsonb(coalesce(v_opp, v_uid::text)), true);
    v_state := jsonb_set(v_state, '{turnStartedAt}', to_jsonb(v_now), true);
  end if;
  perform public._rh_save(p_room_id, v_state);
end; $$;

-- ── Flag: grace-aware, sets endReason ───────────────────────────────────────

create or replace function public.rh_flag(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb; v_holder text; v_opp text; v_rem bigint; v_seq int;
begin
  if not public.is_member(p_room_id) then return; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null or v_state->>'matchWinner' is not null then return; end if;
  v_holder := v_state->>'turnUserId';
  v_rem := (v_state->'clocks'->v_holder->>'remainingMs')::bigint
           - greatest(0, (v_now - (v_state->>'turnStartedAt')::bigint) - 15000);
  if v_rem > 0 then return; end if;
  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> v_holder limit 1;
  if v_opp is null then return; end if;
  v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
  v_state := jsonb_set(v_state, array['clocks', v_holder],
    jsonb_build_object('remainingMs', 0, 'out', true), true);
  v_state := jsonb_set(v_state, '{matchWinner}', to_jsonb(v_opp), true);
  v_state := jsonb_set(v_state, '{endReason}', '"timeout"'::jsonb, true);
  v_state := jsonb_set(v_state, '{beat}',
    jsonb_build_object('kind','outOfTime','userId',v_holder,'seq',v_seq), true);
  perform public._rh_save(p_room_id, v_state);
end; $$;

-- ── Advance: carry the client's endReason on the decide branch ───────────────

create or replace function public.rh_advance(p_room_id uuid, p_state jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_cur jsonb; v_first text; v_opp text; v_boardnum int; v_starter text; v_state jsonb;
begin
  select game_state into v_cur from public.rooms
    where id = p_room_id and host_id = v_uid and status = 'in_progress' for update;
  if v_cur is null then raise exception 'Only the host can advance'; end if;

  if p_state->>'matchWinner' is not null then
    v_state := jsonb_set(v_cur, '{matchWinner}', p_state->'matchWinner', true);
    v_state := jsonb_set(v_state, '{endReason}',
      coalesce(p_state->'endReason', '"boards"'::jsonb), true);
    v_state := jsonb_set(v_state, '{beat}', coalesce(p_state->'beat', v_cur->'beat'), true);
    update public.rooms set game_state = v_state where id = p_room_id;
    return;
  end if;

  v_first := v_cur->>'firstStarter';
  select p->>'userId' into v_opp from jsonb_array_elements(v_cur->'players') p
    where p->>'userId' <> v_first limit 1;
  v_boardnum := (v_cur->>'boardNumber')::int + 1;
  v_starter := case when v_boardnum % 2 = 1 then v_first else coalesce(v_opp, v_first) end;
  v_state := v_cur;
  v_state := jsonb_set(v_state, '{rows}', p_state->'rows', true);
  v_state := jsonb_set(v_state, '{cols}', p_state->'cols', true);
  v_state := jsonb_set(v_state, '{signature}', p_state->'signature', true);
  v_state := jsonb_set(v_state, '{board}', p_state->'board', true);
  v_state := jsonb_set(v_state, '{boardNumber}', to_jsonb(v_boardnum), true);
  v_state := jsonb_set(v_state, '{boardWinner}', 'null'::jsonb, true);
  v_state := jsonb_set(v_state, '{turnUserId}', to_jsonb(v_starter), true);
  v_state := jsonb_set(v_state, '{turnStartedAt}', to_jsonb(v_now), true);
  update public.rooms set game_state = v_state where id = p_room_id;
end; $$;

-- ── Loss paths now record WHY ───────────────────────────────────────────────

drop function if exists public.rh_apply_loss(uuid, text, uuid);

create or replace function public.rh_apply_loss(
  p_room_id uuid, p_match_id text, p_loser uuid, p_reason text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_state jsonb; v_opp text; v_seq int;
begin
  select game_state into v_state from public.rooms where id = p_room_id for update;
  if v_state is null or v_state->>'matchWinner' is not null then return; end if;
  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> p_loser::text limit 1;
  if v_opp is null then return; end if;

  v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
  v_state := jsonb_set(v_state, '{matchWinner}', to_jsonb(v_opp), true);
  v_state := jsonb_set(v_state, '{endReason}', to_jsonb(p_reason), true);
  v_state := jsonb_set(v_state, '{beat}',
    jsonb_build_object('kind','winner','userId',v_opp,'seq',v_seq), true);
  update public.rooms set game_state = v_state where id = p_room_id;

  insert into public.ranked_elo_log (match_id) values (p_match_id)
    on conflict (match_id) do nothing;
  if not found then return; end if;
  perform public.rh_settle_value(p_match_id, v_opp::uuid, p_loser, false);
end; $$;

revoke execute on function public.rh_apply_loss(uuid, text, uuid, text) from public, anon, authenticated;

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
  perform public.rh_apply_loss(p_room_id, p_match_id, v_uid, 'surrender');
end; $$;

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
  v_state := jsonb_set(v_state, '{blurs}', coalesce(v_state->'blurs', '{}'::jsonb), true);
  v_count := coalesce((v_state->'blurs'->>v_uid::text)::int, 0) + 1;
  v_state := jsonb_set(v_state, array['blurs', v_uid::text], to_jsonb(v_count), true);
  update public.rooms set game_state = v_state where id = p_room_id;
  if v_count >= 3 then
    perform public.rh_apply_loss(p_room_id, p_match_id, v_uid, 'left');
  end if;
end; $$;

-- ── Heartbeat + abandonment (app killed / crashed / offline) ─────────────────

create or replace function public.rh_heartbeat(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb;
begin
  if v_uid is null or not public.is_member(p_room_id) then return; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null or v_state->>'matchWinner' is not null then return; end if;
  v_state := jsonb_set(v_state, '{seen}', coalesce(v_state->'seen', '{}'::jsonb), true);
  v_state := jsonb_set(v_state, array['seen', v_uid::text], to_jsonb(v_now), true);
  update public.rooms set game_state = v_state where id = p_room_id;
end; $$;

-- The caller claims the win when the opponent has gone silent past ABANDON_MS.
create or replace function public.rh_claim_abandon(p_match_id text, p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb; v_opp text; v_seen bigint;
begin
  if v_uid is null or not public.is_member(p_room_id) then return; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null or v_state->>'matchWinner' is not null then return; end if;
  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> v_uid::text limit 1;
  if v_opp is null then return; end if;
  v_seen := (v_state->'seen'->>v_opp)::bigint;
  -- Only once they've actually checked in and then gone quiet.
  if v_seen is null or (v_now - v_seen) < 20000 then return; end if;
  perform public.rh_apply_loss(p_room_id, p_match_id, v_opp::uuid, 'left');
end; $$;

grant execute on function public.rh_heartbeat(uuid) to authenticated;
grant execute on function public.rh_claim_abandon(text, uuid) to authenticated;
