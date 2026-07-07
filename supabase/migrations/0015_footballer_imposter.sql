-- Miflo: Footballer Imposter — a networked social-deduction party game.
--
-- Unlike Tic-Tac-Toe (0012), where all state is public and the active player's
-- client computes the next state, Imposter has two secrets that must NOT leak:
--   * which player is the imposter, and
--   * which footballer the detectives were given.
-- Because `game_state` is broadcast to every device via Realtime, and because
-- the host must not learn the imposter (they could be the imposter), roles are
-- assigned SERVER-SIDE and kept in a private table that no client can read
-- directly — each device fetches only its own role through get_my_imposter_role.
--
-- The public game_state only carries coordination data (phase, round, turn
-- order, current asker's target, a vote COUNT, running scores). The secret
-- (imposter id + footballer) is revealed into game_state only once the game is
-- over (phase 'reveal').
--
-- The 'asking' turn phase reuses the existing play_move RPC (0012): writes are
-- gated by game_state.turnUserId, exactly like Tic-Tac-Toe.

-- ── Private tables (RLS on, NO select policy → unreadable by clients; only the
--    SECURITY DEFINER RPCs below, owned by the table owner, can read them) ─────

create table if not exists public.imposter_secrets (
  room_id          uuid primary key references public.rooms (id) on delete cascade,
  imposter_user_id uuid not null references auth.users (id) on delete cascade,
  footballer_id    text not null,
  created_at       timestamptz not null default now()
);

create table if not exists public.imposter_votes (
  room_id        uuid not null references public.rooms (id) on delete cascade,
  voter_user_id  uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  primary key (room_id, voter_user_id)
);

alter table public.imposter_secrets enable row level security;
alter table public.imposter_votes enable row level security;
-- Deliberately no policies: clients cannot select/insert directly, and these
-- tables are NOT added to the realtime publication, so secrets never broadcast.

-- ── Host starts a hand: assign roles server-side and open the asking phase ────

create or replace function public.start_imposter_game(
  p_room_id uuid,
  p_pool    text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_players   jsonb;
  v_order     jsonb;
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

  -- Roster snapshot + fresh zero scores.
  select
    jsonb_agg(jsonb_build_object('userId', user_id, 'name', name)),
    jsonb_object_agg(user_id::text, 0)
  into v_players, v_scores
  from public.players
  where room_id = p_room_id;

  -- Random ask order (independent of who is the imposter).
  select jsonb_agg(user_id order by random())
  into v_order
  from public.players
  where room_id = p_room_id;

  select user_id into v_imposter
  from public.players
  where room_id = p_room_id
  order by random()
  limit 1;

  v_footballer := p_pool[1 + floor(random() * array_length(p_pool, 1))::int];

  insert into public.imposter_secrets (room_id, imposter_user_id, footballer_id)
  values (p_room_id, v_imposter, v_footballer)
  on conflict (room_id) do update
    set imposter_user_id = excluded.imposter_user_id,
        footballer_id = excluded.footballer_id,
        created_at = now();

  delete from public.imposter_votes where room_id = p_room_id;

  v_state := jsonb_build_object(
    'gameType', 'footballer-imposter',
    'phase', 'asking',
    'round', 1,
    'order', v_order,
    'turnUserId', v_order->>0,
    'askTargetUserId', null,
    'players', v_players,
    'votedCount', 0,
    'scores', v_scores
  );

  update public.rooms
  set status = 'in_progress',
      game_type = 'footballer-imposter',
      game_state = v_state
  where id = p_room_id;
end;
$$;

-- ── Host plays another hand (Play again): new roles, scores carried forward ───

create or replace function public.restart_imposter_game(
  p_room_id uuid,
  p_pool    text[]
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
  v_order      jsonb;
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

  select jsonb_agg(user_id order by random())
  into v_order
  from public.players
  where room_id = p_room_id;

  select user_id into v_imposter
  from public.players
  where room_id = p_room_id
  order by random()
  limit 1;

  v_footballer := p_pool[1 + floor(random() * array_length(p_pool, 1))::int];

  insert into public.imposter_secrets (room_id, imposter_user_id, footballer_id)
  values (p_room_id, v_imposter, v_footballer)
  on conflict (room_id) do update
    set imposter_user_id = excluded.imposter_user_id,
        footballer_id = excluded.footballer_id,
        created_at = now();

  delete from public.imposter_votes where room_id = p_room_id;

  v_state := jsonb_build_object(
    'gameType', 'footballer-imposter',
    'phase', 'asking',
    'round', 1,
    'order', v_order,
    'turnUserId', v_order->>0,
    'askTargetUserId', null,
    'players', v_players,
    'votedCount', 0,
    'scores', v_scores
  );

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

-- ── Each device fetches ONLY its own role (the sole way a client learns it) ───

create or replace function public.get_my_imposter_role(p_room_id uuid)
returns table (role text, footballer_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from public.players
    where room_id = p_room_id and user_id = v_uid
  ) then
    return; -- not a member: no rows
  end if;

  return query
  select
    case when s.imposter_user_id = v_uid then 'imposter' else 'detective' end,
    case when s.imposter_user_id = v_uid then null else s.footballer_id end
  from public.imposter_secrets s
  where s.room_id = p_room_id;
end;
$$;

-- ── Voting (off-turn): each player votes once; the last vote resolves the hand ─

create or replace function public.cast_imposter_vote(
  p_room_id uuid,
  p_target  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_state      jsonb;
  v_imposter   uuid;
  v_footballer text;
  v_nplayers   int;
  v_nvotes     int;
  v_maxcnt     int;
  v_impcnt     int;
  v_caught     boolean;
  v_votes      jsonb;
  v_deltas     jsonb;
  v_scores     jsonb;
begin
  if not exists (
    select 1 from public.players where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'Only players in the room can vote';
  end if;

  select game_state into v_state
  from public.rooms
  where id = p_room_id and status = 'in_progress';

  if v_state is null or v_state->>'phase' <> 'voting' then
    raise exception 'Not in the voting phase';
  end if;

  insert into public.imposter_votes (room_id, voter_user_id, target_user_id)
  values (p_room_id, v_uid, p_target)
  on conflict (room_id, voter_user_id)
  do update set target_user_id = excluded.target_user_id;

  select count(*) into v_nvotes from public.imposter_votes where room_id = p_room_id;
  select count(*) into v_nplayers from public.players where room_id = p_room_id;
  v_state := jsonb_set(v_state, '{votedCount}', to_jsonb(v_nvotes));

  if v_nvotes >= v_nplayers then
    select imposter_user_id, footballer_id into v_imposter, v_footballer
    from public.imposter_secrets where room_id = p_room_id;

    -- Most-voted count, and how many the imposter got.
    select coalesce(max(cnt), 0) into v_maxcnt
    from (
      select count(*) cnt from public.imposter_votes
      where room_id = p_room_id group by target_user_id
    ) t;
    select count(*) into v_impcnt
    from public.imposter_votes
    where room_id = p_room_id and target_user_id = v_imposter;
    v_caught := (v_impcnt = v_maxcnt and v_maxcnt > 0);

    -- Full voter -> target map, revealed now the game is over.
    select jsonb_object_agg(voter_user_id::text, target_user_id::text)
    into v_votes
    from public.imposter_votes where room_id = p_room_id;

    -- Per-player points this hand: detectives +1 for fingering the imposter;
    -- the imposter +3 if they escaped the majority, else 0 (redemption is a
    -- separate step).
    select jsonb_object_agg(
      p.user_id::text,
      case
        when p.user_id = v_imposter then (case when v_caught then 0 else 3 end)
        else (
          case when exists (
            select 1 from public.imposter_votes v
            where v.room_id = p_room_id
              and v.voter_user_id = p.user_id
              and v.target_user_id = v_imposter
          ) then 1 else 0 end
        )
      end
    )
    into v_deltas
    from public.players p
    where p.room_id = p_room_id;

    -- New running totals = prior scores + this hand's deltas.
    v_scores := v_state->'scores';
    select jsonb_object_agg(
      key,
      coalesce((v_scores->>key)::int, 0) + coalesce((v_deltas->>key)::int, 0)
    )
    into v_scores
    from jsonb_object_keys(v_deltas) as key;

    v_state := jsonb_set(v_state, '{phase}', to_jsonb('reveal'::text));
    v_state := jsonb_set(v_state, '{scores}', v_scores);
    v_state := jsonb_set(v_state, '{reveal}', jsonb_build_object(
      'imposterId', v_imposter::text,
      'footballerId', v_footballer,
      'caught', v_caught,
      'votes', coalesce(v_votes, '{}'::jsonb),
      'deltas', v_deltas
    ), true);
  end if;

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

-- ── Redemption: a caught imposter guesses the footballer to steal points ──────

create or replace function public.imposter_guess(
  p_room_id   uuid,
  p_footballer text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_imposter   uuid;
  v_footballer text;
  v_state      jsonb;
  v_correct    boolean;
begin
  select imposter_user_id, footballer_id into v_imposter, v_footballer
  from public.imposter_secrets where room_id = p_room_id;

  if v_imposter is null or v_imposter <> v_uid then
    raise exception 'Only the imposter can guess';
  end if;

  select game_state into v_state
  from public.rooms
  where id = p_room_id and status = 'in_progress';

  if v_state is null or v_state->>'phase' <> 'reveal' then
    raise exception 'Not in the reveal phase';
  end if;
  if not coalesce((v_state->'reveal'->>'caught')::boolean, false) then
    raise exception 'No redemption available';
  end if;
  if v_state->'reveal'->'redemption' is not null then
    return; -- already guessed
  end if;

  v_correct := (p_footballer = v_footballer);
  v_state := jsonb_set(
    v_state, '{reveal,redemption}',
    jsonb_build_object('guessId', p_footballer, 'correct', v_correct), true
  );

  if v_correct then
    v_state := jsonb_set(
      v_state, array['scores', v_imposter::text],
      to_jsonb(coalesce((v_state->'scores'->>(v_imposter::text))::int, 0) + 2)
    );
    v_state := jsonb_set(
      v_state, array['reveal', 'deltas', v_imposter::text],
      to_jsonb(coalesce((v_state->'reveal'->'deltas'->>(v_imposter::text))::int, 0) + 2)
    );
  end if;

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

grant execute on function public.start_imposter_game(uuid, text[]) to authenticated;
grant execute on function public.restart_imposter_game(uuid, text[]) to authenticated;
grant execute on function public.get_my_imposter_role(uuid) to authenticated;
grant execute on function public.cast_imposter_vote(uuid, uuid) to authenticated;
grant execute on function public.imposter_guess(uuid, text) to authenticated;
