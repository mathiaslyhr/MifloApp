-- Party invites: APNs push tokens.
--
-- One row per user (one iPhone, iPhone-only app): the hex APNs device token
-- the app uploads after the user grants notification permission. Tokens are
-- write-only for clients — there is deliberately NO select policy, so no app
-- session can ever read another device's token (or its own). The only reader
-- is the send-party-invite Edge Function via the service role, which looks up
-- a friend's token server-side and posts to Apple.
--
-- What friends CAN learn is reachability: get_reachable_friends() returns
-- which of the caller's friends have a token at all (existence, never the
-- value), so the invite sheet can mark who would actually receive a push.
--
-- Pattern as everywhere else: RLS on, writes via SECURITY DEFINER RPC keyed
-- on auth.uid().

create table if not exists public.push_tokens (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  token      text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;
-- No policies on purpose: clients can neither select nor write directly.

-- Upsert the caller's token. APNs tokens are 64 hex chars today, but Apple
-- says treat length as opaque — bound it loosely instead of pinning 64.
create or replace function public.set_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text := lower(btrim(coalesce(p_token, '')));
begin
  if v_token !~ '^[0-9a-f]{16,200}$' then
    raise exception 'Malformed token';
  end if;
  insert into public.push_tokens (user_id, token)
  values (v_uid, v_token)
  on conflict (user_id) do update
    set token = excluded.token, updated_at = now();
end;
$$;

-- Which of my friends can receive a push. Existence only — the token value
-- never crosses this boundary.
create or replace function public.get_reachable_friends()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select pt.user_id
  from public.push_tokens pt
  where public.are_friends(pt.user_id, auth.uid());
$$;

grant execute on function public.set_push_token(text) to authenticated;
grant execute on function public.get_reachable_friends() to authenticated;
