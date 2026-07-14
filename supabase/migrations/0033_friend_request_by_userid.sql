-- Friend requests by user_id — so the party lobby can offer "Add friend" on a
-- roster player.
--
-- 0024's send_friend_request(p_code) resolves the target by their FRIEND CODE,
-- which is all the Friends-tab search has. But a lobby roster player carries only
-- their auth uid (players.user_id = auth.uid()), never a code, and RLS blocks
-- reading a non-friend's profile to discover one. So this adds a sibling RPC that
-- resolves the target by user_id server-side and otherwise behaves identically.
--
-- send_friend_request(p_code) is deliberately left untouched (it's live in shipped
-- binaries); this is a standalone function so nothing already installed changes.
--
-- Same pattern as everywhere: SECURITY DEFINER, keyed on auth.uid(), same jsonb
-- shape and the same four quiet outcomes as 0024 so the client wrapper is reused.

create or replace function public.send_friend_request_by_userid(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_target public.profiles;
  v_status text;
begin
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'No profile';
  end if;

  select * into v_target from public.profiles where user_id = p_user_id;
  if not found then
    raise exception 'Friend code not found';
  end if;
  if v_target.user_id = v_uid then
    raise exception 'That is your own code';
  end if;

  if public.are_friends(v_uid, v_target.user_id) then
    v_status := 'already_friends';
  elsif exists (
    select 1 from public.friend_requests
    where requester = v_target.user_id and addressee = v_uid
  ) then
    -- Mutual intent: their pending request is the acceptance of ours.
    delete from public.friend_requests
    where (requester = v_target.user_id and addressee = v_uid)
       or (requester = v_uid and addressee = v_target.user_id);
    insert into public.friendships (user_a, user_b)
    values (least(v_uid, v_target.user_id), greatest(v_uid, v_target.user_id))
    on conflict do nothing;
    v_status := 'auto_accepted';
  elsif exists (
    select 1 from public.friend_requests
    where requester = v_uid and addressee = v_target.user_id
  ) then
    v_status := 'already_requested';
  else
    -- Backstop against spam; 50 genuine pending requests is already implausible.
    if (select count(*) from public.friend_requests where requester = v_uid) >= 50 then
      raise exception 'Too many pending requests';
    end if;
    insert into public.friend_requests (requester, addressee)
    values (v_uid, v_target.user_id);
    v_status := 'requested';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'user_id', v_target.user_id,
    'display_name', v_target.display_name,
    'friend_code', v_target.friend_code,
    'last_seen_at', v_target.last_seen_at
  );
end;
$$;

grant execute on function public.send_friend_request_by_userid(uuid) to authenticated;
