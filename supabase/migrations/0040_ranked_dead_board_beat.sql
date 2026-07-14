-- Miflo — Ranked: announce the DEAD BOARD. 0039 abandoned an unsolvable grid but
-- said nothing: players saw a "MISSED" toast, then the board silently swapped and
-- announced a new starter, with no clue why. The dead-board turn now mints its own
-- 'deadBoard' beat so both devices toast the reason.
-- Mirrors applyMove in src/games/ranked-hattrick/engine.ts.

create or replace function public.rh_move(
  p_room_id uuid, p_cell int, p_footballer_id text, p_correct boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_state jsonb; v_opp text; v_raw bigint; v_spent bigint; v_rem bigint;
  v_board jsonb; v_bw text; v_scores jsonb; v_level boolean; v_seq int;
  v_noclaim int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select game_state into v_state from public.rooms
    where id = p_room_id and status = 'in_progress' for update;
  if v_state is null then raise exception 'Game not in progress'; end if;
  if v_state->>'matchWinner' is not null or v_state->>'boardWinner' is not null then return; end if;
  if v_state->>'turnUserId' <> v_uid::text then return; end if;

  select p->>'userId' into v_opp from jsonb_array_elements(v_state->'players') p
    where p->>'userId' <> v_uid::text limit 1;

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
    v_noclaim := coalesce((v_state->>'noClaimTurns')::int, 0) + 1;
    v_seq := coalesce((v_state->'beat'->>'seq')::int, 0) + 1;
    v_state := jsonb_set(v_state, '{noClaimTurns}', to_jsonb(v_noclaim), true);
    if v_noclaim >= 4 then
      -- Dead board: 0-0, and SAY SO — the host then loads the next grid.
      v_state := jsonb_set(v_state, '{boardWinner}', '"dead"'::jsonb, true);
      v_state := jsonb_set(v_state, '{beat}',
        jsonb_build_object('kind','deadBoard','seq',v_seq), true);
    else
      v_state := jsonb_set(v_state, '{beat}',
        jsonb_build_object('kind','missed','userId',v_uid::text,'seq',v_seq), true);
      v_state := jsonb_set(v_state, '{turnUserId}', to_jsonb(coalesce(v_opp, v_uid::text)), true);
      v_state := jsonb_set(v_state, '{turnStartedAt}', to_jsonb(v_now), true);
    end if;
    perform public._rh_save(p_room_id, v_state); return;
  end if;

  v_board := jsonb_set(v_state->'board', array[p_cell::text],
    jsonb_build_object('userId', v_uid::text, 'footballerId', p_footballer_id), true);
  v_state := jsonb_set(v_state, '{board}', v_board, true);
  v_state := jsonb_set(v_state, '{usedFootballerIds}',
    (v_state->'usedFootballerIds') || to_jsonb(p_footballer_id), true);
  v_state := jsonb_set(v_state, '{noClaimTurns}', '0'::jsonb, true);
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
