-- Miflo: Offside — a networked odd-one-out race.
--
-- Every round shows four footballers; three share a hidden attribute and one
-- is offside. Everyone answers simultaneously against a shared 20-second
-- deadline; faster correct answers score more (500-1000, computed client-side
-- from the same server deadline, re-verified here).
--
-- Unlike Imposter (0015) this game has NO secrets: the host builds the deck
-- client-side (src/games/offside/questions.ts) and ships it in the start RPC,
-- so the whole game state — outlier indexes included — lives in the broadcast
-- `rooms.game_state`. That is the same trust model as Tic-Tac-Toe's
-- client-computed boards; what the server DOES enforce is answer integrity:
-- each submit is checked against the stored deck (wrong answer → 0 points, a
-- correct one clamped to the legal range), and scores only ever accumulate
-- server-side. So no private tables, and no play_move either — turnUserId
-- stays JSON null all game, which keeps the generic 0012 RPC locked; the two
-- host-paced transitions get their own guarded RPCs because each new question
-- needs a deadline stamped from the SERVER clock.
--
-- Phases: 'question' (everyone races; the last present player's submit — or
-- the host's post-deadline force_offside_reveal — resolves the round) →
-- 'reveal' (host advances via advance_offside_round) → ... → 'standings'.
--
-- The 20-second window is mirrored client-side as QUESTION_DURATION_MS in
-- src/games/offside/types.ts; change both together.

-- ── Internal: resolve the current question into a reveal. Pure jsonb → jsonb,
--    shared by the submit and force paths; not client-callable. ───────────────

create or replace function public.offside_resolve_round(p_state jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_scores jsonb;
  v_state  jsonb := p_state;
begin
  -- Running totals += this round's (already server-verified) points. Keys come
  -- from the roster snapshot in `scores`, so a stray answer can't mint a player.
  select jsonb_object_agg(
    key,
    coalesce((v_state->'scores'->>key)::int, 0)
      + coalesce((v_state->'answers'->key->>'points')::int, 0)
  )
  into v_scores
  from jsonb_object_keys(v_state->'scores') as key;

  v_state := jsonb_set(v_state, '{scores}', coalesce(v_scores, v_state->'scores'));
  v_state := jsonb_set(v_state, '{phase}', to_jsonb('reveal'::text));
  v_state := jsonb_set(v_state, '{roundEndsAt}', 'null'::jsonb);
  return v_state;
end;
$$;

revoke execute on function public.offside_resolve_round(jsonb)
  from public, anon, authenticated;

-- ── Deck validation, shared by start + restart: an array of exactly p_rounds
--    rounds, each with 4 cards, an in-range outlier and a criterion object. ────

create or replace function public.offside_check_deck(p_deck jsonb, p_rounds int)
returns void
language plpgsql
immutable
as $$
begin
  if p_rounds is null or p_rounds < 1 or p_rounds > 20 then
    raise exception 'Round count out of range';
  end if;
  if p_deck is null
     or jsonb_typeof(p_deck) <> 'array'
     or jsonb_array_length(p_deck) <> p_rounds then
    raise exception 'Deck does not match the round count';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_deck) r
    where jsonb_typeof(r->'cards') <> 'array'
       or jsonb_array_length(r->'cards') <> 4
       or jsonb_typeof(r->'outlierIndex') <> 'number'
       or (r->>'outlierIndex')::numeric not in (0, 1, 2, 3)
       or jsonb_typeof(r->'criterion') <> 'object'
  ) then
    raise exception 'Malformed deck';
  end if;
end;
$$;

revoke execute on function public.offside_check_deck(jsonb, int)
  from public, anon, authenticated;

-- ── Host starts a game from the lobby ─────────────────────────────────────────

create or replace function public.start_offside_game(
  p_room_id uuid,
  p_deck    jsonb,
  p_rounds  int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_players jsonb;
  v_scores  jsonb;
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_id = v_uid and status = 'lobby'
  ) then
    raise exception 'Only the host can start a game from the lobby';
  end if;

  perform public.offside_check_deck(p_deck, p_rounds);

  -- Roster snapshot + fresh zero scores.
  select
    jsonb_agg(jsonb_build_object('userId', user_id, 'name', name)),
    jsonb_object_agg(user_id::text, 0)
  into v_players, v_scores
  from public.players
  where room_id = p_room_id;

  update public.rooms
  set status = 'in_progress',
      game_type = 'offside',
      game_state = jsonb_build_object(
        'gameType', 'offside',
        'phase', 'question',
        'round', 1,
        'rounds', p_rounds,
        'deck', p_deck,
        'roundEndsAt', to_jsonb(now() + interval '20 seconds'),
        'turnUserId', null,
        'players', v_players,
        'answers', '{}'::jsonb,
        'answeredCount', 0,
        'scores', v_scores
      )
  where id = p_room_id;
end;
$$;

-- ── Host plays again from the standings: fresh deck, fresh scores. A match is
--    a complete unit, so nothing carries forward (unlike Imposter's hands). ────

create or replace function public.restart_offside_game(
  p_room_id uuid,
  p_deck    jsonb,
  p_rounds  int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_players jsonb;
  v_scores  jsonb;
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_id = v_uid and status = 'in_progress'
      and game_state->>'gameType' = 'offside'
  ) then
    raise exception 'Only the host can restart the game';
  end if;

  perform public.offside_check_deck(p_deck, p_rounds);

  -- Re-snapshot the roster so leavers drop off and everyone restarts at zero.
  select
    jsonb_agg(jsonb_build_object('userId', user_id, 'name', name)),
    jsonb_object_agg(user_id::text, 0)
  into v_players, v_scores
  from public.players
  where room_id = p_room_id;

  update public.rooms
  set game_state = jsonb_build_object(
        'gameType', 'offside',
        'phase', 'question',
        'round', 1,
        'rounds', p_rounds,
        'deck', p_deck,
        'roundEndsAt', to_jsonb(now() + interval '20 seconds'),
        'turnUserId', null,
        'players', v_players,
        'answers', '{}'::jsonb,
        'answeredCount', 0,
        'scores', v_scores
      )
  where id = p_room_id;
end;
$$;

-- ── A player answers (or times out with option null). Off-turn: everyone
--    writes through here while turnUserId stays null. Guards return SILENTLY
--    so a late timeout auto-submit racing the resolve is harmless. ─────────────

create or replace function public.submit_offside_answer(
  p_room_id uuid,
  p_round   int,
  p_option  int,
  p_points  int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_state   jsonb;
  v_outlier int;
  v_points  int;
  v_n       int;
  v_total   int;
begin
  if not exists (
    select 1 from public.players where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'Only players in the room can answer';
  end if;

  -- Row lock serializes concurrent submits, so the last two can't both see an
  -- incomplete count and leave the round unresolved.
  select game_state into v_state
  from public.rooms
  where id = p_room_id and status = 'in_progress'
  for update;

  if v_state is null
     or v_state->>'gameType' <> 'offside'
     or v_state->>'phase' <> 'question'
     or (v_state->>'round')::int <> p_round
     or v_state->'answers' ? v_uid::text then
    return; -- stale or duplicate submit: ignore
  end if;

  -- The deck is the authority: a wrong (or timed-out) pick is worth 0 no
  -- matter what the client claims, and a correct one stays in the legal range.
  v_outlier := (v_state->'deck'->(p_round - 1)->>'outlierIndex')::int;
  if p_option is not null and p_option = v_outlier then
    v_points := least(1000, greatest(500, coalesce(p_points, 0)));
  else
    v_points := 0;
  end if;

  v_state := jsonb_set(
    v_state,
    array['answers', v_uid::text],
    jsonb_build_object('option', p_option, 'points', v_points),
    true
  );

  -- Count answers from players still in the room, so a leaver never blocks.
  select count(*) into v_n
  from public.players p
  where p.room_id = p_room_id and v_state->'answers' ? p.user_id::text;
  select count(*) into v_total
  from public.players where room_id = p_room_id;

  v_state := jsonb_set(v_state, '{answeredCount}', to_jsonb(v_n));

  if v_n >= v_total then
    v_state := public.offside_resolve_round(v_state);
  end if;

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

-- ── Host force-resolves a stuck question once the deadline has passed (a
--    player left mid-question, backgrounded the app, lost connection...). The
--    client calls this a few seconds of grace after the deadline. ──────────────

create or replace function public.force_offside_reveal(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_state   jsonb;
  v_missing jsonb;
  v_total   int;
begin
  select game_state into v_state
  from public.rooms
  where id = p_room_id and host_id = v_uid and status = 'in_progress'
  for update;

  if v_state is null then
    raise exception 'Only the host can resolve the round';
  end if;
  if v_state->>'gameType' <> 'offside' or v_state->>'phase' <> 'question' then
    return; -- already resolved: idempotent
  end if;
  if now() < (v_state->>'roundEndsAt')::timestamptz then
    raise exception 'The round is still running';
  end if;

  -- Everyone still present who never answered scores 0 this round.
  select coalesce(
    jsonb_object_agg(
      p.user_id::text,
      jsonb_build_object('option', null, 'points', 0)
    ),
    '{}'::jsonb
  )
  into v_missing
  from public.players p
  where p.room_id = p_room_id
    and not v_state->'answers' ? p.user_id::text;

  v_state := jsonb_set(v_state, '{answers}', (v_state->'answers') || v_missing);

  select count(*) into v_total
  from public.players where room_id = p_room_id;
  v_state := jsonb_set(v_state, '{answeredCount}', to_jsonb(v_total));

  v_state := public.offside_resolve_round(v_state);

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

-- ── Host moves on from a reveal: next question (fresh server-clock deadline)
--    or, after the last round, the final standings. Wrong-phase calls return
--    silently so a double tap can't skip a question. ─────────────────────────

create or replace function public.advance_offside_round(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_state jsonb;
begin
  select game_state into v_state
  from public.rooms
  where id = p_room_id and host_id = v_uid and status = 'in_progress'
  for update;

  if v_state is null then
    raise exception 'Only the host can advance the game';
  end if;
  if v_state->>'gameType' <> 'offside' or v_state->>'phase' <> 'reveal' then
    return; -- double tap or stale call: ignore
  end if;

  if (v_state->>'round')::int < (v_state->>'rounds')::int then
    v_state := jsonb_set(v_state, '{round}', to_jsonb((v_state->>'round')::int + 1));
    v_state := jsonb_set(v_state, '{phase}', to_jsonb('question'::text));
    v_state := jsonb_set(v_state, '{answers}', '{}'::jsonb);
    v_state := jsonb_set(v_state, '{answeredCount}', to_jsonb(0));
    v_state := jsonb_set(v_state, '{roundEndsAt}', to_jsonb(now() + interval '20 seconds'));
  else
    v_state := jsonb_set(v_state, '{phase}', to_jsonb('standings'::text));
    v_state := jsonb_set(v_state, '{roundEndsAt}', 'null'::jsonb);
  end if;

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

grant execute on function public.start_offside_game(uuid, jsonb, int) to authenticated;
grant execute on function public.restart_offside_game(uuid, jsonb, int) to authenticated;
grant execute on function public.submit_offside_answer(uuid, int, int, int) to authenticated;
grant execute on function public.force_offside_reveal(uuid) to authenticated;
grant execute on function public.advance_offside_round(uuid) to authenticated;
