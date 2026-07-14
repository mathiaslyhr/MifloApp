-- Miflo — Ranked: one metric, "Value" (€). Replaces the ELO rating with a
-- footballer market value that rises on a win, falls on a loss, capped at €250M.
-- Opponent-weighted (ELO math over the value itself), all in euros. Mirrors the
-- pure TS in src/games/ranked-hattrick/value.ts.
--
-- Tunables (parity with constants.ts): START €10M (default), FLOOR €1M,
-- CAP €250M, K €5M (max even swing), SCALE €40M.

alter table public.player_ratings rename column rating to value;
alter table public.player_ratings alter column value type bigint;
alter table public.player_ratings alter column value set default 10000000;

-- Clamp helper.
create or replace function public.rh_clamp_value(v bigint)
returns bigint language sql immutable as $$
  select greatest(1000000::bigint, least(250000000::bigint, v));
$$;

-- ── ELO-in-euros: settle a match, writing € deltas ───────────────────────────
-- Applies to (winner, loser); a draw passes p_draw = true.

create or replace function public.rh_settle_value(
  p_match_id text, p_winner uuid, p_loser uuid, p_draw boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  val_w bigint; val_l bigint; e_w numeric; score_w numeric; d bigint;
  new_w bigint; new_l bigint;
begin
  select coalesce((select value from public.player_ratings where user_id = p_winner), 10000000) into val_w;
  select coalesce((select value from public.player_ratings where user_id = p_loser),  10000000) into val_l;
  e_w := 1.0 / (1.0 + power(10.0, (val_l - val_w) / 40000000.0));
  score_w := case when p_draw then 0.5 else 1.0 end;
  d := round(5000000 * (score_w - e_w))::bigint;
  new_w := public.rh_clamp_value(val_w + d);
  new_l := public.rh_clamp_value(val_l - d);

  insert into public.player_ratings (user_id, value, games) values (p_winner, new_w, 1)
    on conflict (user_id) do update
    set value = new_w, games = public.player_ratings.games + 1, updated_at = now();
  insert into public.player_ratings (user_id, value, games) values (p_loser, new_l, 1)
    on conflict (user_id) do update
    set value = new_l, games = public.player_ratings.games + 1, updated_at = now();
  -- Record the actual (post-clamp) € change so the trend is truthful.
  insert into public.rating_events (match_id, user_id, delta) values
    (p_match_id, p_winner, new_w - val_w),
    (p_match_id, p_loser, new_l - val_l);
end; $$;

revoke execute on function public.rh_settle_value(text, uuid, uuid, boolean) from public, anon, authenticated;

-- ── rh_finish (normal end): host records the € result, once per match ─────────

create or replace function public.rh_finish(
  p_match_id text, p_room_id uuid, p_winner uuid, p_loser uuid, p_draw boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.rooms where id = p_room_id and host_id = v_uid) then
    raise exception 'Only the host records the result';
  end if;
  insert into public.ranked_elo_log (match_id) values (p_match_id)
    on conflict (match_id) do nothing;
  if not found then return; end if; -- already applied
  perform public.rh_settle_value(p_match_id, p_winner, p_loser, p_draw);
end; $$;

-- ── rh_apply_loss (forfeit / kick): the caller loses, once per match ──────────

create or replace function public.rh_apply_loss(
  p_room_id uuid, p_match_id text, p_loser uuid
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
  v_state := jsonb_set(v_state, '{beat}',
    jsonb_build_object('kind','winner','userId',v_opp,'seq',v_seq), true);
  update public.rooms set game_state = v_state where id = p_room_id;

  insert into public.ranked_elo_log (match_id) values (p_match_id)
    on conflict (match_id) do nothing;
  if not found then return; end if;
  perform public.rh_settle_value(p_match_id, v_opp::uuid, p_loser, false);
end; $$;

-- ── Matchmaking: pair by CLOSEST value ───────────────────────────────────────

create or replace function public.rh_find_match(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_value bigint;
  v_opp uuid; v_opp_name text;
  v_room uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_value := coalesce((select value from public.player_ratings where user_id = v_uid), 10000000);

  select user_id, name into v_opp, v_opp_name
  from public.ranked_queue
  where room_id is null and user_id <> v_uid
  order by abs(rating - v_value), enqueued_at
  limit 1
  for update skip locked;

  if v_opp is null then
    insert into public.ranked_queue (user_id, rating, name, enqueued_at, room_id)
    values (v_uid, v_value, p_name, now(), null)
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
