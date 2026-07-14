-- Miflo — Ranked Hattrick pivot to TURN-BASED (chess clock). Replaces the
-- simultaneous-lock RPCs from 0034. Players alternate turns; the mover's clock
-- is charged the time they took; running out loses the match (flag). The starter
-- is server-random on board 1 and alternates each board. Mirrors the pure TS in
-- src/games/ranked-hattrick/engine.ts.

-- Locks are gone.
drop function if exists public.rh_lock(uuid, int);
drop function if exists public.rh_resolve(uuid, int, text, text);
drop function if exists public.rh_sweep(jsonb, bigint);
drop function if exists public.rh_burn(jsonb, int, bigint);

-- ── Start: host writes the board; the SERVER picks a fair random starter ─────

create or replace function public.rh_start(p_room_id uuid, p_state jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_players jsonb; v_starter text; v_state jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.rooms where id = p_room_id and host_id = v_uid) then
    raise exception 'Only the host can start';
  end if;
  v_players := p_state->'players';
  v_starter := (v_players->(floor(random() * jsonb_array_length(v_players))::int))->>'userId';
  v_state := p_state;
  v_state := jsonb_set(v_state, '{turnUserId}', to_jsonb(v_starter), true);
  v_state := jsonb_set(v_state, '{firstStarter}', to_jsonb(v_starter), true);
  v_state := jsonb_set(v_state, '{turnStartedAt}', to_jsonb(v_now), true);
  update public.rooms set game_state = v_state, status = 'in_progress' where id = p_room_id;
end; $$;

-- ── Move: charge the clock, claim/miss, flip the turn (or decide the board) ───

create or replace function public.rh_move(
  p_room_id uuid, p_cell int, p_footballer_id text, p_correct boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb; v_opp text; v_spent bigint; v_rem bigint;
  v_board jsonb; v_bw text; v_scores jsonb; v_level boolean; v_seq int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null then raise exception 'Game not in progress'; end if;
  if v_state->>'matchWinner' is not null or v_state->>'boardWinner' is not null then return; end if;
  if v_state->>'turnUserId' <> v_uid::text then return; end if; -- not your turn

  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> v_uid::text limit 1;

  -- Charge this turn's time to the mover.
  v_spent := greatest(0, v_now - (v_state->>'turnStartedAt')::bigint);
  v_rem := greatest(0, (v_state->'clocks'->(v_uid::text)->>'remainingMs')::bigint - v_spent);
  v_state := jsonb_set(v_state, array['clocks', v_uid::text],
    jsonb_build_object('remainingMs', v_rem, 'out', v_rem <= 0), true);
  insert into public.ranked_answer_log (room_id, user_id, cell, correct, ms)
    values (p_room_id, v_uid, p_cell, coalesce(p_correct, false), v_spent);

  -- Flag fell on the move → the mover loses.
  if v_rem <= 0 and v_opp is not null then
    v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
    v_state := jsonb_set(v_state, '{matchWinner}', to_jsonb(v_opp), true);
    v_state := jsonb_set(v_state, '{beat}',
      jsonb_build_object('kind','outOfTime','userId',v_uid::text,'seq',v_seq), true);
    perform public._rh_save(p_room_id, v_state); return;
  end if;

  -- Miss → pass the turn.
  if not coalesce(p_correct, false) or p_footballer_id is null then
    v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
    v_state := jsonb_set(v_state, '{turnUserId}', to_jsonb(coalesce(v_opp, v_uid::text)), true);
    v_state := jsonb_set(v_state, '{turnStartedAt}', to_jsonb(v_now), true);
    v_state := jsonb_set(v_state, '{beat}',
      jsonb_build_object('kind','missed','userId',v_uid::text,'seq',v_seq), true);
    perform public._rh_save(p_room_id, v_state); return;
  end if;

  -- Correct → claim the cell.
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

-- ── Flag: any member may end the match if the turn-holder's clock is spent ────

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
           - greatest(0, v_now - (v_state->>'turnStartedAt')::bigint);
  if v_rem > 0 then return; end if;
  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> v_holder limit 1;
  if v_opp is null then return; end if;
  v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
  v_state := jsonb_set(v_state, array['clocks', v_holder],
    jsonb_build_object('remainingMs', 0, 'out', true), true);
  v_state := jsonb_set(v_state, '{matchWinner}', to_jsonb(v_opp), true);
  v_state := jsonb_set(v_state, '{beat}',
    jsonb_build_object('kind','outOfTime','userId',v_holder,'seq',v_seq), true);
  perform public._rh_save(p_room_id, v_state);
end; $$;

-- ── Advance: host loads the next board (server sets the alternate starter),
--    or decides the match. Clocks/scores/firstStarter are server-preserved. ───

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

  -- Match decided (final board): honour the winner/beat, touch nothing else.
  if p_state->>'matchWinner' is not null then
    v_state := jsonb_set(v_cur, '{matchWinner}', p_state->'matchWinner', true);
    v_state := jsonb_set(v_state, '{beat}', coalesce(p_state->'beat', v_cur->'beat'), true);
    update public.rooms set game_state = v_state where id = p_room_id;
    return;
  end if;

  -- Next board: take only the new grid content; rebuild turn/board server-side.
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

grant execute on function public.rh_start(uuid, jsonb) to authenticated;
grant execute on function public.rh_move(uuid, int, text, boolean) to authenticated;
grant execute on function public.rh_flag(uuid) to authenticated;
grant execute on function public.rh_advance(uuid, jsonb) to authenticated;
