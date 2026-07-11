-- Miflo: raise the host-pickable round maximums now that the lobby uses a
-- stepper instead of preset circles.
--   * Red Card:  2..10 (was 2..4)  — question pool holds 27 ids.
--   * Cult Hero: 3..8  (was 3..5)  — 8 is the client's variety hard cap
--     (MAX_PER_KIND = 2 across the 4 prompt kinds in prompts.ts).
--   * Offside: unchanged — offside_check_deck (0017) already allows 1..20.
--
-- Function bodies are copied UNCHANGED from 0015 (start/restart_red_card_game)
-- and 0018 (cult_hero_check_prompts) except for the single bounds check.

-- ── Red Card: host starts a hand ──────────────────────────────────────────────

create or replace function public.start_red_card_game(
  p_room_id      uuid,
  p_pool         text[],
  p_rounds       int,
  p_question_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_players   jsonb;
  v_scores    jsonb;
  v_imposter  uuid;
  v_footballer text;
  v_state     jsonb;
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_id = v_uid and status = 'lobby'
  ) then
    raise exception 'Only the host can start a game from the lobby';
  end if;

  -- Guard the secret: a tiny pool would let a malicious host know the footballer
  -- (and thus cheat if they turn out to be the imposter). The client ships the
  -- full set of illustrated players; this floor blocks a shrunk pool.
  if p_pool is null or coalesce(array_length(p_pool, 1), 0) < 12 then
    raise exception 'Footballer pool too small';
  end if;

  if p_rounds is null or p_rounds < 2 or p_rounds > 10 then
    raise exception 'Round count out of range';
  end if;
  -- Question ids are opaque i18n keys (each device localizes its own copy);
  -- only shape is validated here.
  if p_question_ids is null
     or coalesce(array_length(p_question_ids, 1), 0) < p_rounds
     or exists (
       select 1 from unnest(p_question_ids[1:p_rounds]) q
       where q is null or char_length(q) > 8
     ) then
    raise exception 'Bad question ids';
  end if;

  -- Roster snapshot + fresh zero scores.
  select
    jsonb_agg(jsonb_build_object('userId', user_id, 'name', name)),
    jsonb_object_agg(user_id::text, 0)
  into v_players, v_scores
  from public.players
  where room_id = p_room_id;

  select user_id into v_imposter
  from public.players
  where room_id = p_room_id
  order by random()
  limit 1;

  v_footballer := p_pool[1 + floor(random() * array_length(p_pool, 1))::int];

  insert into public.red_card_secrets (room_id, imposter_user_id, footballer_id)
  values (p_room_id, v_imposter, v_footballer)
  on conflict (room_id) do update
    set imposter_user_id = excluded.imposter_user_id,
        footballer_id = excluded.footballer_id,
        created_at = now();

  delete from public.red_card_votes where room_id = p_room_id;
  delete from public.red_card_answers where room_id = p_room_id;

  -- turnUserId is JSON null: play_move stays locked until a round resolves
  -- and hands the reveal paging to the host.
  v_state := jsonb_build_object(
    'gameType', 'red-card',
    'phase', 'answering',
    'round', 1,
    'rounds', p_rounds,
    'questionIds', to_jsonb(p_question_ids[1:p_rounds]),
    'turnUserId', null,
    'players', v_players,
    'answeredCount', 0,
    'answerIndex', 0,
    'votedCount', 0,
    'scores', v_scores
  );

  update public.rooms
  set status = 'in_progress',
      game_type = 'red-card',
      game_state = v_state
  where id = p_room_id;
end;
$$;

-- ── Red Card: host plays another hand (Play again) ────────────────────────────

create or replace function public.restart_red_card_game(
  p_room_id      uuid,
  p_pool         text[],
  p_rounds       int,
  p_question_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_prev       jsonb;
  v_players    jsonb;
  v_scores     jsonb;
  v_imposter   uuid;
  v_footballer text;
  v_state      jsonb;
begin
  select game_state into v_prev
  from public.rooms
  where id = p_room_id and host_id = v_uid and status = 'in_progress';

  if not found then
    raise exception 'Only the host can restart the game';
  end if;
  if p_pool is null or coalesce(array_length(p_pool, 1), 0) < 12 then
    raise exception 'Footballer pool too small';
  end if;
  if p_rounds is null or p_rounds < 2 or p_rounds > 10 then
    raise exception 'Round count out of range';
  end if;
  if p_question_ids is null
     or coalesce(array_length(p_question_ids, 1), 0) < p_rounds
     or exists (
       select 1 from unnest(p_question_ids[1:p_rounds]) q
       where q is null or char_length(q) > 8
     ) then
    raise exception 'Bad question ids';
  end if;

  -- Roster snapshot; carry forward each current player's score (new joiners 0).
  select
    jsonb_agg(jsonb_build_object('userId', user_id, 'name', name)),
    jsonb_object_agg(
      user_id::text,
      coalesce((v_prev->'scores'->>(user_id::text))::int, 0)
    )
  into v_players, v_scores
  from public.players
  where room_id = p_room_id;

  select user_id into v_imposter
  from public.players
  where room_id = p_room_id
  order by random()
  limit 1;

  v_footballer := p_pool[1 + floor(random() * array_length(p_pool, 1))::int];

  insert into public.red_card_secrets (room_id, imposter_user_id, footballer_id)
  values (p_room_id, v_imposter, v_footballer)
  on conflict (room_id) do update
    set imposter_user_id = excluded.imposter_user_id,
        footballer_id = excluded.footballer_id,
        created_at = now();

  delete from public.red_card_votes where room_id = p_room_id;
  delete from public.red_card_answers where room_id = p_room_id;

  v_state := jsonb_build_object(
    'gameType', 'red-card',
    'phase', 'answering',
    'round', 1,
    'rounds', p_rounds,
    'questionIds', to_jsonb(p_question_ids[1:p_rounds]),
    'turnUserId', null,
    'players', v_players,
    'answeredCount', 0,
    'answerIndex', 0,
    'votedCount', 0,
    'scores', v_scores
  );

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

-- ── Cult Hero: prompt payload validation (start + restart both call this) ─────

create or replace function public.cult_hero_check_prompts(p_prompts jsonb, p_rounds int)
returns void
language plpgsql
immutable
as $$
begin
  if p_rounds is null or p_rounds < 3 or p_rounds > 8 then
    raise exception 'Round count out of range';
  end if;
  if p_prompts is null
     or jsonb_typeof(p_prompts) <> 'array'
     or jsonb_array_length(p_prompts) < p_rounds then
    raise exception 'Prompts do not match the round count';
  end if;
  -- Keys are stable dataset-derived ids (they aggregate the global stats, so
  -- shape-check them hard); each eligible set must clear the same floor the
  -- app enforces (MIN_ELIGIBLE), or the percentile scoring loses meaning.
  if exists (
    select 1
    from jsonb_array_elements(p_prompts) with ordinality t(pr, i)
    where i <= p_rounds
      and (
        coalesce(pr->>'key', '') !~ '^(club|nat|league|honour):.{1,60}$'
        or jsonb_typeof(pr->'eligible') <> 'array'
        or jsonb_array_length(pr->'eligible') < 10
        or exists (
          select 1 from jsonb_array_elements(pr->'eligible') e
          where coalesce(e->>'id', '') = ''
             or char_length(e->>'id') > 80
             or jsonb_typeof(e->'w') <> 'number'
             or (e->>'w')::numeric < 0
        )
      )
  ) then
    raise exception 'Malformed prompts';
  end if;
end;
$$;

revoke execute on function public.cult_hero_check_prompts(jsonb, int)
  from public, anon, authenticated;
