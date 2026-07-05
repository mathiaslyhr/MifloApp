-- Miflo: lobby interactions — self-rename and host kick.
--
-- Design notes:
--  * Same model as M2 (0001_rooms.sql): players is SELECT-only under RLS, so
--    every write goes through a SECURITY DEFINER RPC. These two add the Among
--    Us-style lobby actions the client couldn't do directly.
--  * rename_player: a player renames their OWN row (room-scoped, no device
--    memory — the app types a name each round).
--  * kick_player: the host removes another player while still in the lobby.
--    Deleting the row fires a realtime players change; the kicked client sees
--    itself gone (RLS also cuts its read) and leaves the lobby.

-- ── A player renames themselves ──────────────────────────────────────────────
create or replace function public.rename_player(
  p_room_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'Name required';
  end if;

  update public.players
  set name = left(v_name, 20)
  where room_id = p_room_id and user_id = v_uid;

  if not found then
    raise exception 'Not a member of this room';
  end if;
end;
$$;

-- ── Host removes a player ────────────────────────────────────────────────────
create or replace function public.kick_player(
  p_room_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Only the host, only while gathering in the lobby.
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_id = v_uid and status = 'lobby'
  ) then
    raise exception 'Only the host can remove players from the lobby';
  end if;

  if p_user_id = v_uid then
    raise exception 'The host cannot remove themselves';
  end if;

  delete from public.players
  where room_id = p_room_id and user_id = p_user_id and is_host = false;

  if not found then
    raise exception 'Player not found';
  end if;
end;
$$;

grant execute on function public.rename_player(uuid, text) to authenticated;
grant execute on function public.kick_player(uuid, uuid) to authenticated;
