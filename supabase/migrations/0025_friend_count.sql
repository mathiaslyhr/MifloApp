-- 0025: friend_count — how many friends a profile has, for the profile pages.
--
-- The friendships RLS policy only lets you read rows you are part of, so a
-- friend's count is invisible to plain selects. This SECURITY DEFINER read
-- mirrors profiles_select's spirit: you may count yourself or a friend;
-- anyone else gets NULL (the client hides the line).
create or replace function public.friend_count(p_user_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    when p_user_id = auth.uid() or public.are_friends(p_user_id, auth.uid())
    then (select count(*)::int from public.friendships
          where p_user_id in (user_a, user_b))
  end;
$$;

revoke execute on function public.friend_count(uuid) from public, anon;
grant execute on function public.friend_count(uuid) to authenticated;
