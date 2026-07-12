-- Miflo: delete account (App Store Review Guideline 5.1.1(v)).
--
-- Miflo has no login, but a device opts into a profile (a chosen display name,
-- friend code, avatar and friends). Apple requires any app that lets a user
-- create an account/profile to offer in-app deletion, so this RPC wipes every
-- row keyed to the caller's anonymous identity (auth.uid()):
--
--   * profiles       — deleting this cascades friendships, daily_results and
--                      friend_requests via their on-delete-cascade FKs
--                      (0020_social.sql / 0024_friend_requests.sql).
--   * push_tokens    — references auth.users, so it does NOT cascade from
--                      profiles; deleted explicitly.
--   * players        — room-roster rows; cleared so any open lobby drops them.
--
-- The avatar storage object (avatars/<uid>/avatar.jpg) is removed client-side,
-- where the owner holds the avatars_delete policy (0026_avatars.sql). The
-- anonymous auth.users row is left as-is: it holds no personal data, and the
-- client signs out so the next launch mints a fresh identity.
--
-- Pattern as everywhere else: SECURITY DEFINER, keyed on auth.uid(),
-- authenticated-only.

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

  delete from public.push_tokens where user_id = v_uid;
  delete from public.players     where user_id = v_uid;
  -- Cascades friendships, daily_results and friend_requests.
  delete from public.profiles    where user_id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
