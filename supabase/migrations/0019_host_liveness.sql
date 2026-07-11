-- Miflo: host liveness — detect an abandoned party (host force-quit, stayed
-- backgrounded, or lost connectivity) so guests aren't stranded in a stale
-- lobby. Explicit leaves already close the room via leave_room (0010); this
-- covers the host who never got to tap back.
--
--  * heartbeat_room: the host pings while foregrounded (~25s cadence,
--    HEARTBEAT_INTERVAL_MS in src/core/rooms/liveness.ts; change together).
--  * close_stale_room: any member may ask to close the room, but the delete
--    only happens if the host has been silent for 60s BY THE SERVER CLOCK —
--    a buggy, offline, or malicious guest can never kill a live party.
--  * Deleting the room reuses the exact leave_room path: players cascade,
--    the rooms DELETE event reaches every device, guests exit via onClosed.
--
-- Known residual: a room whose host dies before any guest joins has nobody to
-- close it. Harmless — join_room still works there and the first joiner's
-- watchdog closes it ~90s later.

alter table public.rooms
  add column if not exists host_last_seen timestamptz not null default now();

-- Idempotent: silently no-ops when the room is gone or the caller isn't the
-- host (a late timer after the party closed is not an error).
create or replace function public.heartbeat_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms
  set host_last_seen = now()
  where id = p_room_id and host_id = auth.uid();
end;
$$;

-- Returns whether the room was closed. false = not a member (already kicked
-- or gone) or the host is actually alive and the caller just missed events.
create or replace function public.close_stale_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_room_id) then
    return false;
  end if;

  delete from public.rooms
  where id = p_room_id
    and host_last_seen < now() - interval '60 seconds';
  return found;
end;
$$;

grant execute on function public.heartbeat_room(uuid) to authenticated;
grant execute on function public.close_stale_room(uuid) to authenticated;
