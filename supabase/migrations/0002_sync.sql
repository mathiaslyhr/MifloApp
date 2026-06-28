-- Miflo M4: host-authoritative synced in-round loop.
--
-- The room row already carries the loop state (phase, current_index,
-- phase_deadline — added unused in 0001). The host now writes each transition
-- here; every device renders from the room via Realtime, so all phones show the
-- same question with the same countdown.

-- Host advances the round: set the current phase, question index, and the
-- absolute deadline the clients count down to.
create or replace function public.set_phase(
  p_room_id  uuid,
  p_phase    text,
  p_index    int,
  p_deadline timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_phase not in ('question', 'reveal', 'standings') then
    raise exception 'Invalid phase %', p_phase;
  end if;

  update public.rooms
  set phase = p_phase,
      current_index = p_index,
      phase_deadline = p_deadline
  where id = p_room_id and host_id = v_uid and status = 'in_progress';

  if not found then
    raise exception 'Only the host can set the phase of an in-progress room';
  end if;
end;
$$;

-- Host ends the game after the last standings.
create or replace function public.finish_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.rooms
  set status = 'finished'
  where id = p_room_id and host_id = v_uid;

  if not found then
    raise exception 'Only the host can finish the game';
  end if;
end;
$$;

grant execute on function public.set_phase(uuid, text, int, timestamptz) to authenticated;
grant execute on function public.finish_game(uuid) to authenticated;
