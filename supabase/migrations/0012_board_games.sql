-- Miflo: turn-based board games (Tic-Tac-Toe football grid, first).
--
-- The quiz uses a host-driven phase clock (0002_sync). Board games are
-- turn-based instead: a shared game_state jsonb on the room, advanced one move
-- at a time by whichever player's turn it is. Every device renders from
-- game_state via the existing subscribeRoom Realtime channel.
--
-- Authority: play_move only succeeds if the caller is the current-turn player.
-- The board itself is computed client-side (football facts live in the app, not
-- the DB) — fine for a friendly in-the-same-room app.

alter table public.rooms add column if not exists game_state jsonb;

-- Host starts a board game from the lobby: stash the initial state + type.
create or replace function public.start_board_game(
  p_room_id   uuid,
  p_game_type text,
  p_state     jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.rooms
  set status = 'in_progress',
      game_type = p_game_type,
      game_state = p_state
  where id = p_room_id and host_id = v_uid and status = 'lobby';

  if not found then
    raise exception 'Only the host can start a game from the lobby';
  end if;
end;
$$;

-- Any player takes their turn: write the next state, but only if it's their
-- turn on the CURRENT row (server-enforced turn order).
create or replace function public.play_move(
  p_room_id uuid,
  p_state   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_turn text;
begin
  select game_state->>'turnUserId' into v_turn
  from public.rooms
  where id = p_room_id and status = 'in_progress';

  if v_turn is null then
    raise exception 'Game is not in progress';
  end if;
  if v_turn <> v_uid::text then
    raise exception 'Not your turn';
  end if;

  update public.rooms set game_state = p_state where id = p_room_id;
end;
$$;

-- Host restarts the board game in place (Play again) with a fresh state, without
-- returning to the lobby.
create or replace function public.restart_board_game(
  p_room_id uuid,
  p_state   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.rooms
  set game_state = p_state
  where id = p_room_id and host_id = v_uid and status = 'in_progress';

  if not found then
    raise exception 'Only the host can restart the game';
  end if;
end;
$$;

-- Host returns the party to the lobby (Back to lobby): clears the
-- game so the party stays alive for another round.
create or replace function public.return_to_lobby(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.rooms
  set status = 'lobby',
      game_state = null,
      game_type = 'unset'
  where id = p_room_id and host_id = v_uid;

  if not found then
    raise exception 'Only the host can return the party to the lobby';
  end if;
end;
$$;

grant execute on function public.start_board_game(uuid, text, jsonb) to authenticated;
grant execute on function public.play_move(uuid, jsonb) to authenticated;
grant execute on function public.restart_board_game(uuid, jsonb) to authenticated;
grant execute on function public.return_to_lobby(uuid) to authenticated;
