-- 0048: delete still has to mean delete.
--
-- 0045 fixed exactly this and 0046 broke it again: delete_my_account() wipes
-- "every row keyed to the caller's anonymous identity", and party_invites did
-- not exist when that list was written. So since this morning, deleting your
-- account left your invites behind.
--
-- The FK is `references auth.users on delete cascade`, which does NOT help:
-- delete_my_account deletes the PROFILE, not the auth user, so the rows simply
-- outlive it. Same trap 0045 hit with player_ratings and rating_events.
--
-- Both directions go. An invite you SENT is keyed to you as surely as one you
-- received, and unlike a match (rh_match_history keeps the fixture and loses the
-- name) an invite is not a shared record of something two people did — it is a
-- message from one to the other. When the sender is gone there is nothing left
-- to show, and the recipient's own log inner-joins rooms anyway.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.push_tokens    where user_id = v_uid;
  delete from public.players        where user_id = v_uid;
  -- The ranked footprint (0034/0037/0041), added in 0045.
  delete from public.ranked_queue   where user_id = v_uid;
  delete from public.rating_events  where user_id = v_uid;
  delete from public.player_ratings where user_id = v_uid;
  -- The invite log (0046). Both ends: sent and received.
  delete from public.party_invites  where to_user_id = v_uid or from_user_id = v_uid;
  -- Cascades friendships, daily_results and friend_requests.
  delete from public.profiles       where user_id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
