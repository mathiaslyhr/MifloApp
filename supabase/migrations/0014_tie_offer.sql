-- Miflo: mutual "agree to a tie" for board games.
--
-- Unlike play_move (0012), which only the current-turn player may call, a tie is
-- a handshake: ANY player can propose ending the game in a tie (e.g. nobody
-- knows another answer), and the game only ends once EVERY side has accepted.
--
-- These writes are members-only and touch just the `tieOffer` subfield of
-- game_state (and, on completion, flip `winner` to 'tie' — computed server-side
-- so a single player can't force the result). The board itself is never altered
-- here.

-- Resolve the caller's sideId from game_state (individual mode: sideId = userId;
-- teams mode: the side whose memberUserIds contains the caller).
create or replace function public.propose_tie(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_state jsonb;
  v_side  text;
begin
  if not exists (
    select 1 from public.players
    where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'Only players in the room can propose a tie';
  end if;

  select game_state into v_state
  from public.rooms
  where id = p_room_id and status = 'in_progress';

  if v_state is null or v_state->>'turnUserId' is null then
    raise exception 'Game is not in progress';
  end if;
  if v_state->>'winner' is not null then
    return; -- already decided
  end if;

  select s->>'id' into v_side
  from jsonb_array_elements(v_state->'sides') s
  where s->'memberUserIds' ? v_uid::text;

  if v_side is null then
    raise exception 'You are not a side in this game';
  end if;

  -- The proposer implicitly accepts.
  update public.rooms
  set game_state = jsonb_set(
    v_state,
    '{tieOffer}',
    jsonb_build_object('by', v_side, 'accepted', jsonb_build_array(v_side)),
    true
  )
  where id = p_room_id;
end;
$$;

-- Accept adds the caller's side to the tally (and ends the game as a tie once all
-- sides have accepted); decline clears the offer so play resumes.
create or replace function public.respond_tie(p_room_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_state    jsonb;
  v_side     text;
  v_accepted jsonb;
  v_all_ok   boolean;
begin
  if not exists (
    select 1 from public.players
    where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'Only players in the room can respond to a tie';
  end if;

  select game_state into v_state
  from public.rooms
  where id = p_room_id and status = 'in_progress';

  if v_state is null or v_state->'tieOffer' is null then
    return; -- no offer on the table
  end if;
  if v_state->>'winner' is not null then
    return;
  end if;

  select s->>'id' into v_side
  from jsonb_array_elements(v_state->'sides') s
  where s->'memberUserIds' ? v_uid::text;

  if v_side is null then
    raise exception 'You are not a side in this game';
  end if;

  -- Decline: drop the offer, keep playing.
  if not p_accept then
    update public.rooms set game_state = v_state - 'tieOffer' where id = p_room_id;
    return;
  end if;

  -- Accept: union this side into the accepted list.
  select coalesce(jsonb_agg(distinct e), '[]'::jsonb) into v_accepted
  from (
    select jsonb_array_elements_text(v_state->'tieOffer'->'accepted') as e
    union
    select v_side
  ) u;

  -- All sides accounted for?
  select not exists (
    select 1
    from jsonb_array_elements(v_state->'sides') s
    where not (v_accepted ? (s->>'id'))
  ) into v_all_ok;

  if v_all_ok then
    update public.rooms
    set game_state = jsonb_set(v_state - 'tieOffer', '{winner}', to_jsonb('tie'::text), true)
    where id = p_room_id;
  else
    update public.rooms
    set game_state = jsonb_set(v_state, '{tieOffer,accepted}', v_accepted, true)
    where id = p_room_id;
  end if;
end;
$$;

grant execute on function public.propose_tie(uuid) to authenticated;
grant execute on function public.respond_tie(uuid, boolean) to authenticated;
