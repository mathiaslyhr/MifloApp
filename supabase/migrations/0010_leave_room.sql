-- Miflo: leaving a party.
--
-- Same RPC-only model as the rest of the lobby (players is SELECT-only under
-- RLS). Handles both cases idempotently:
--  * Host leaves → delete the room; players cascade-delete via the FK, so the
--    party closes for everyone (guests auto-eject client-side when they vanish
--    from the roster).
--  * Guest leaves → delete just their own player row (no ghost name left behind).
-- Idempotent: no error if there's nothing to delete (e.g. already kicked).

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if exists (
    select 1 from public.rooms where id = p_room_id and host_id = v_uid
  ) then
    delete from public.rooms where id = p_room_id;
    return;
  end if;

  delete from public.players
  where room_id = p_room_id and user_id = v_uid;
end;
$$;

grant execute on function public.leave_room(uuid) to authenticated;
