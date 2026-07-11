-- Friend requests: adding a friend is now ask-then-accept, not instant.
--
-- 0020 made typing a code create an instant MUTUAL friendship. That felt
-- wrong in practice (someone can be friended without ever agreeing), so the
-- flow becomes: typing a code sends a directed request; the addressee accepts
-- (friendship row appears) or declines (request row disappears). If both
-- sides request each other, the second send counts as the acceptance.
--
-- The table is directed on purpose: friendships' canonical `user_a < user_b`
-- ordering deliberately erases direction, but a request is nothing WITHOUT
-- its direction. Decline/cancel simply delete the row — no status column, no
-- tombstones, so a declined person can ask again later and nothing lingers.
--
-- add_friend(text) is dropped below: the Friends tab never shipped in a
-- binary, so no installed app calls it.
--
-- Pattern as everywhere else: RLS on, clients only SELECT, every write goes
-- through a SECURITY DEFINER RPC keyed on auth.uid().

create table if not exists public.friend_requests (
  requester  uuid not null references public.profiles (user_id) on delete cascade,
  addressee  uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friend_requests_addressee_idx
  on public.friend_requests (addressee);

-- ── Helpers ───────────────────────────────────────────────────────────────────

-- SECURITY DEFINER so profiles_select below can consult friend_requests
-- without evaluating its own RLS recursively (same trick as are_friends).
create or replace function public.has_request_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friend_requests
    where (requester = a and addressee = b)
       or (requester = b and addressee = a)
  );
$$;

revoke execute on function public.has_request_between(uuid, uuid) from public, anon;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.friend_requests enable row level security;
drop policy if exists friend_requests_select on public.friend_requests;
create policy friend_requests_select on public.friend_requests
  for select using (auth.uid() in (requester, addressee));

-- Widen profiles_select: the two ends of a pending request can now read each
-- other's profile row (the addressee needs the requester's name to render
-- "X wants to be friends"; the requester renders "Waiting for X"). This
-- exposes the whole row (incl. last_seen_at) to a pending counterpart, not
-- just the name — accepted: the requester already knew the code they typed,
-- and declining deletes the request row, which instantly revokes the read.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    user_id = auth.uid()
    or public.are_friends(user_id, auth.uid())
    or public.has_request_between(user_id, auth.uid())
  );

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Send a request to whoever owns p_code. Returns jsonb so the client can tell
-- apart the four quiet outcomes without extra round trips:
--   'requested'         a fresh request row was created
--   'auto_accepted'     they had already requested us — that IS the consent,
--                       so both rows are consumed and the friendship exists
--   'already_requested' our earlier request is still pending
--   'already_friends'   nothing to do
-- Error strings for bad codes are kept byte-identical to 0020's add_friend —
-- the app classifies them by substring (socialService.isUnknownCodeError).
create or replace function public.send_friend_request(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_target public.profiles;
  v_status text;
begin
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'No profile';
  end if;

  select * into v_target from public.profiles where friend_code = v_code;
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
    -- Backstop against code-guessing spam; 50 genuine pending requests is
    -- already an implausible party.
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

-- Accept a pending request FROM p_user_id. Deletes both directions (a
-- simultaneous mutual send self-heals) and creates the friendship.
create or replace function public.accept_friend_request(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from public.friend_requests
    where requester = p_user_id and addressee = v_uid
  ) then
    raise exception 'No request';
  end if;

  delete from public.friend_requests
  where (requester = p_user_id and addressee = v_uid)
     or (requester = v_uid and addressee = p_user_id);

  insert into public.friendships (user_a, user_b)
  values (least(v_uid, p_user_id), greatest(v_uid, p_user_id))
  on conflict do nothing;
end;
$$;

-- Decline a pending request FROM p_user_id. Idempotent and silent — the
-- requester is never told, their "Waiting for X" line just quietly persists
-- until they cancel (or ask again, which recreates the row).
create or replace function public.decline_friend_request(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friend_requests
  where requester = p_user_id and addressee = auth.uid();
$$;

-- Cancel my own outgoing request TO p_user_id. No UI calls this yet; shipped
-- now so a future "cancel" affordance needs no new SQL-editor session.
create or replace function public.cancel_friend_request(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friend_requests
  where requester = auth.uid() and addressee = p_user_id;
$$;

-- The instant-add era ends here (never shipped in a binary — safe to drop).
drop function if exists public.add_friend(text);

grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
