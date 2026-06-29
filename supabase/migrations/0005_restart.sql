-- Miflo: let the host restart a finished game in the same room ("Play again").
--
-- start_game only runs on a 'lobby' room and there's no way to reset scores, so a
-- finished room can't be replayed. restart_game recycles the same room: it swaps
-- in a fresh deck, rewinds the loop state, and zeroes every player's score so the
-- leaderboard starts over. Guests follow the room back into the game via Realtime
-- (same as start_game), so everyone re-plays together.

create or replace function public.restart_game(p_room_id uuid, p_questions jsonb)
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
      questions = p_questions,
      current_index = 0,
      phase = null,
      phase_deadline = null
  where id = p_room_id and host_id = v_uid and status = 'finished';

  if not found then
    raise exception 'Only the host can restart a finished room';
  end if;

  -- Fresh leaderboard: zero everyone's score for the new game.
  update public.players set score = 0 where room_id = p_room_id;
end;
$$;

grant execute on function public.restart_game(uuid, jsonb) to authenticated;
