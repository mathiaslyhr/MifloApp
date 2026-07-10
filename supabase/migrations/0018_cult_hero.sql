-- Miflo: Cult Hero — a networked rarest-answer game (Pointless with players).
--
-- Every round shows one prompt ("Name a player who has played for Real
-- Madrid"); everyone secretly picks a real footballer, and when the last pick
-- lands the round resolves: a pick that matches the prompt scores its
-- obscurity percentile (0 for the most famous eligible answer, 100 for the
-- uniquely rarest), a wrong pick scores 0.
--
-- Trust model: like Offside (0017), there are no per-player secrets, but two
-- things must stay server-side anyway:
--   * this round's picks — hidden until everyone is in (mirrors 0015's
--     red_card_answers), so nobody can dodge a duplicate or copy a rare pick;
--   * rarity itself — scored here against `cult_hero_stats`, the pick counts
--     accumulated by EVERY Cult Hero game ever played, so all devices agree
--     no matter which OTA dataset version they run.
-- Football facts still live in the app, not the DB: the host ships each
-- prompt's eligible footballer ids with fame-prior pseudo-counts (the cold
-- start for rarity; see src/games/cult-hero/famePrior.ts) at start time, and
-- "wrong answer" simply means "not in the shipped eligible set".
--
-- Phases: 'answering' is off-turn — every player submits through
-- submit_cult_hero_answer while game_state.turnUserId is null, which keeps the
-- generic play_move RPC (0012) locked. 'roundReveal' is host-paced: the
-- resolving submit sets turnUserId to the host, who pages through the scored
-- results via play_move (see advanceRoundReveal in the app) — into the round's
-- leaderboard, then the next question, or the final standings after the last
-- round.

-- ── Global rarity stats: how often each footballer has been answered for each
--    prompt, across all rooms and forever. Only VALID picks are logged. ───────

create table if not exists public.cult_hero_stats (
  prompt_key    text not null,
  footballer_id text not null,
  picks         int  not null default 0,
  primary key (prompt_key, footballer_id)
);

-- ── Per-room prompt payloads, shipped by the host at start. Kept out of the
--    broadcast game_state so realtime updates stay slim (the eligible sets can
--    be a few KB per prompt). ─────────────────────────────────────────────────

create table if not exists public.cult_hero_prompts (
  room_id    uuid primary key references public.rooms (id) on delete cascade,
  -- [{key, eligible: [{id, w}]}] — one entry per round, validated on write.
  prompts    jsonb not null,
  created_at timestamptz not null default now()
);

-- ── This round's picks, hidden until the whole round is in — the resolving
--    submit scores them and publishes the results into game_state. ────────────

create table if not exists public.cult_hero_answers (
  room_id       uuid not null references public.rooms (id) on delete cascade,
  round         int  not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  footballer_id text not null,
  created_at    timestamptz not null default now(),
  primary key (room_id, round, user_id)
);

alter table public.cult_hero_stats enable row level security;
alter table public.cult_hero_prompts enable row level security;
alter table public.cult_hero_answers enable row level security;
-- Deliberately no policies: clients cannot read/write directly, and these
-- tables are NOT added to the realtime publication, so picks never broadcast
-- early and the stats stay unqueryable (nobody can look up "what's rare").

-- ── Prompt payload validation, shared by start + restart ──────────────────────

create or replace function public.cult_hero_check_prompts(p_prompts jsonb, p_rounds int)
returns void
language plpgsql
immutable
as $$
begin
  if p_rounds is null or p_rounds < 3 or p_rounds > 5 then
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

-- ── Host starts a game from the lobby ─────────────────────────────────────────

create or replace function public.start_cult_hero_game(
  p_room_id uuid,
  p_rounds  int,
  p_prompts jsonb
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
  v_trimmed jsonb;
  v_keys    jsonb;
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_id = v_uid and status = 'lobby'
  ) then
    raise exception 'Only the host can start a game from the lobby';
  end if;

  perform public.cult_hero_check_prompts(p_prompts, p_rounds);

  -- Store exactly the rounds we'll play; publish only the keys.
  select jsonb_agg(pr order by i), jsonb_agg(pr->>'key' order by i)
  into v_trimmed, v_keys
  from jsonb_array_elements(p_prompts) with ordinality t(pr, i)
  where i <= p_rounds;

  insert into public.cult_hero_prompts (room_id, prompts)
  values (p_room_id, v_trimmed)
  on conflict (room_id) do update
    set prompts = excluded.prompts, created_at = now();

  delete from public.cult_hero_answers where room_id = p_room_id;

  -- Roster snapshot + fresh zero scores.
  select
    jsonb_agg(jsonb_build_object('userId', user_id, 'name', name)),
    jsonb_object_agg(user_id::text, 0)
  into v_players, v_scores
  from public.players
  where room_id = p_room_id;

  -- turnUserId is JSON null: play_move stays locked until a round resolves
  -- and hands the reveal paging to the host.
  update public.rooms
  set status = 'in_progress',
      game_type = 'cult-hero',
      game_state = jsonb_build_object(
        'gameType', 'cult-hero',
        'phase', 'answering',
        'round', 1,
        'rounds', p_rounds,
        'promptKeys', v_keys,
        'turnUserId', null,
        'players', v_players,
        'answeredCount', 0,
        'revealIndex', 0,
        'scores', v_scores
      )
  where id = p_room_id;
end;
$$;

-- ── Host plays again (Play again): fresh prompts, scores carried forward ──────

create or replace function public.restart_cult_hero_game(
  p_room_id uuid,
  p_rounds  int,
  p_prompts jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_prev    jsonb;
  v_players jsonb;
  v_scores  jsonb;
  v_trimmed jsonb;
  v_keys    jsonb;
begin
  select game_state into v_prev
  from public.rooms
  where id = p_room_id and host_id = v_uid and status = 'in_progress'
    and game_state->>'gameType' = 'cult-hero';

  if not found then
    raise exception 'Only the host can restart the game';
  end if;

  perform public.cult_hero_check_prompts(p_prompts, p_rounds);

  select jsonb_agg(pr order by i), jsonb_agg(pr->>'key' order by i)
  into v_trimmed, v_keys
  from jsonb_array_elements(p_prompts) with ordinality t(pr, i)
  where i <= p_rounds;

  insert into public.cult_hero_prompts (room_id, prompts)
  values (p_room_id, v_trimmed)
  on conflict (room_id) do update
    set prompts = excluded.prompts, created_at = now();

  delete from public.cult_hero_answers where room_id = p_room_id;

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

  update public.rooms
  set game_state = jsonb_build_object(
        'gameType', 'cult-hero',
        'phase', 'answering',
        'round', 1,
        'rounds', p_rounds,
        'promptKeys', v_keys,
        'turnUserId', null,
        'players', v_players,
        'answeredCount', 0,
        'revealIndex', 0,
        'scores', v_scores
      )
  where id = p_room_id;
end;
$$;

-- ── Answering (off-turn): each player picks once (resubmit = change answer);
--    the last pick scores the round against the global stats and publishes the
--    results. ──────────────────────────────────────────────────────────────────

create or replace function public.submit_cult_hero_answer(
  p_room_id       uuid,
  p_footballer_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_id      text := btrim(coalesce(p_footballer_id, ''));
  v_state   jsonb;
  v_host    uuid;
  v_round   int;
  v_n       int;
  v_total   int;
  v_prompt  jsonb;
  v_key     text;
  v_size    int;
  v_results jsonb;
  v_scores  jsonb;
begin
  if v_id = '' or char_length(v_id) > 80 then
    raise exception 'Answer must be 1 to 80 characters';
  end if;
  if not exists (
    select 1 from public.players where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'Only players in the room can answer';
  end if;

  -- Row lock serializes concurrent submits, so the last two can't both see an
  -- incomplete count and leave the round unresolved.
  select game_state, host_id into v_state, v_host
  from public.rooms
  where id = p_room_id and status = 'in_progress'
  for update;

  if v_state is null
     or v_state->>'gameType' <> 'cult-hero'
     or v_state->>'phase' <> 'answering' then
    raise exception 'Not in the answering phase';
  end if;
  v_round := (v_state->>'round')::int;

  -- A resubmit before the round resolves just replaces the pick (safe retry,
  -- and the "Change answer" affordance).
  insert into public.cult_hero_answers (room_id, round, user_id, footballer_id)
  values (p_room_id, v_round, v_uid, v_id)
  on conflict (room_id, round, user_id)
  do update set footballer_id = excluded.footballer_id;

  -- Count only answers from players still in the room, so a leaver never
  -- blocks or appears in the results.
  select count(*) into v_n
  from public.cult_hero_answers a
  join public.players p on p.room_id = a.room_id and p.user_id = a.user_id
  where a.room_id = p_room_id and a.round = v_round;
  select count(*) into v_total
  from public.players where room_id = p_room_id;

  v_state := jsonb_set(v_state, '{answeredCount}', to_jsonb(v_n));

  if v_n >= v_total then
    -- Everyone is in: score the round. Weight = host-shipped fame pseudo-count
    -- + global picks BEFORE this round's increment, so in-room duplicates
    -- provably get the same score. A valid answer scores its obscurity
    -- percentile (strictly-heavier count over n-1); an unknown id is a wrong
    -- answer and scores 0. Mirrored client-side by computeScores() for tests.
    select prompts->(v_round - 1) into v_prompt
    from public.cult_hero_prompts where room_id = p_room_id;
    if v_prompt is null then
      raise exception 'Missing prompt payload';
    end if;
    v_key := v_prompt->>'key';
    v_size := jsonb_array_length(v_prompt->'eligible');

    with weights as (
      select e->>'id' as fid, (e->>'w')::numeric + coalesce(s.picks, 0) as w
      from jsonb_array_elements(v_prompt->'eligible') e
      left join public.cult_hero_stats s
        on s.prompt_key = v_key and s.footballer_id = e->>'id'
    ),
    answers as (
      select a.user_id, a.footballer_id
      from public.cult_hero_answers a
      join public.players p on p.room_id = a.room_id and p.user_id = a.user_id
      where a.room_id = p_room_id and a.round = v_round
    ),
    scored as (
      select
        ans.user_id,
        ans.footballer_id,
        (w.fid is not null) as valid,
        case
          when w.fid is null then 0
          else round(
            100.0 * (select count(*) from weights x where x.w > w.w)
            / greatest(v_size - 1, 1)
          )::int
        end as score
      from answers ans
      left join weights w on w.fid = ans.footballer_id
    )
    -- Most-picked first, so the host's reveal builds up to the rarest answer.
    select jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'footballerId', footballer_id,
        'valid', valid,
        'score', score
      )
      order by score asc, random()
    )
    into v_results
    from scored;

    -- Running totals += this round's scores. Keys come from the roster
    -- snapshot, so a stray answer can't mint a player.
    with deltas as (
      select r->>'userId' as uid, (r->>'score')::int as score
      from jsonb_array_elements(v_results) r
    )
    select jsonb_object_agg(
      key,
      coalesce((v_state->'scores'->>key)::int, 0)
        + coalesce((select score from deltas where uid = key), 0)
    )
    into v_scores
    from jsonb_object_keys(v_state->'scores') as key;

    -- Log valid picks into the global rarity stats (AFTER scoring, so this
    -- round can't see itself).
    insert into public.cult_hero_stats (prompt_key, footballer_id, picks)
    select v_key, r->>'footballerId', count(*)::int
    from jsonb_array_elements(v_results) r
    where (r->>'valid')::boolean
    group by r->>'footballerId'
    on conflict (prompt_key, footballer_id)
    do update set picks = cult_hero_stats.picks + excluded.picks;

    v_state := jsonb_set(v_state, '{scores}', coalesce(v_scores, v_state->'scores'));
    v_state := jsonb_set(v_state, '{phase}', to_jsonb('roundReveal'::text));
    v_state := jsonb_set(v_state, '{results}', coalesce(v_results, '[]'::jsonb), true);
    v_state := jsonb_set(v_state, '{revealIndex}', to_jsonb(0));
    v_state := jsonb_set(v_state, '{turnUserId}', to_jsonb(v_host::text));
  end if;

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

grant execute on function public.start_cult_hero_game(uuid, int, jsonb) to authenticated;
grant execute on function public.restart_cult_hero_game(uuid, int, jsonb) to authenticated;
grant execute on function public.submit_cult_hero_answer(uuid, text) to authenticated;
