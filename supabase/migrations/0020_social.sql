-- Miflo Social: friends see each other's daily-game results, no accounts.
--
-- Identity is the app's existing anonymous auth user (auth.uid()); there is
-- still no login. A device opts in by creating a profile: a chosen display
-- name (separate from the random per-room party names, which stay untouched)
-- plus a permanent 6-char friend code. Typing someone's code creates an
-- instant MUTUAL friendship — sharing your code is the consent, so there is
-- no request/accept flow.
--
-- Results are score-level only ("solved in 4", "found 9/11", streak): the
-- games publish a normalized row per (user, day, game) and the actual
-- answers/guesses never leave the device, so nothing here can spoil a puzzle.
--
-- Caveat, accepted for v1 (same as game_results): losing the anon session
-- (reinstall, storage clear) means a new auth.uid() — the old profile,
-- friendships and results are orphaned and friends must re-add.
--
-- Pattern as everywhere else: RLS on, clients only SELECT, every write goes
-- through a SECURITY DEFINER RPC keyed on auth.uid().

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 20),
  friend_code  text not null unique,
  -- Presence heartbeat (touch_presence below). The app pings every 2 minutes
  -- while foregrounded and shows the green "online" dot under 3 minutes
  -- (src/core/social/presence.ts; change together). Only friends can read it,
  -- same as everything else on this row.
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Belt and braces for databases that ran an earlier cut of this file (before
-- presence landed): `create table if not exists` never adds columns.
alter table public.profiles
  add column if not exists last_seen_at timestamptz not null default now();

-- One row per pair, canonically ordered so (a,b) and (b,a) can't both exist.
create table if not exists public.friendships (
  user_a     uuid not null references public.profiles (user_id) on delete cascade,
  user_b     uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_user_b_idx on public.friendships (user_b);

create table if not exists public.daily_results (
  user_id      uuid not null references public.profiles (user_id) on delete cascade,
  date_key     text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  game         text not null check (game in ('scout','tenball','journeyman','teamsheet')),
  -- 'ongoing' = started but unfinished today; the client republishes it as
  -- the count grows and the finish row replaces it (same primary key).
  status       text not null check (status in ('won','revealed','ongoing')),
  -- The tries metric the app shows: scout/journeyman = guesses,
  -- tenball/teamsheet = misses. Never an answer.
  score        int  not null check (score between 0 and 500),
  -- Legacy column from the found-out-of-total design; clients now always
  -- send null. Kept nullable so old queued rows still insert.
  total        int  check (total in (10, 11)),
  -- The client's locally computed streak at publish time (the server can't
  -- reconstruct pre-feature history). The app only trusts it on today's row.
  streak       int  not null default 0 check (streak between 0 and 10000),
  published_at timestamptz not null default now(),
  primary key (user_id, date_key, game)
);
create index if not exists daily_results_user_date_idx
  on public.daily_results (user_id, date_key desc);

-- ── Helpers ───────────────────────────────────────────────────────────────────

-- SECURITY DEFINER so the profiles/daily_results policies below can consult
-- friendships without evaluating friendships' own RLS recursively.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;

-- Permanent 6-char code from gen_code's alphabet (no 0/O/1/I), letter+digit
-- mix required. Longer than room codes because these are global and forever.
create or replace function public.gen_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when candidate ~ '[A-Z]'
          and candidate ~ '[0-9]'
          and not exists (select 1 from public.profiles where friend_code = candidate);
  end loop;
  return candidate;
end;
$$;

revoke execute on function public.gen_friend_code() from public, anon, authenticated;

-- ── RLS: reads only; your row plus your friends' rows ─────────────────────────

-- Drop-then-create keeps the whole file re-runnable (policies have no
-- `create or replace` / `if not exists`).
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));

alter table public.friendships enable row level security;
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select using (auth.uid() in (user_a, user_b));

alter table public.daily_results enable row level security;
drop policy if exists daily_results_select on public.daily_results;
create policy daily_results_select on public.daily_results
  for select using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Create-if-missing and return the caller's profile. Never overwrites an
-- existing display name (that's set_display_name's job), so a double tap or
-- retry is safe.
create or replace function public.ensure_profile(p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_row  public.profiles;
begin
  if length(v_name) < 1 or length(v_name) > 20 then
    raise exception 'Name must be 1 to 20 characters';
  end if;

  insert into public.profiles (user_id, display_name, friend_code)
  values (v_uid, v_name, public.gen_friend_code())
  on conflict (user_id) do nothing;

  select * into v_row from public.profiles where user_id = v_uid;
  return v_row;
end;
$$;

create or replace function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
begin
  if length(v_name) < 1 or length(v_name) > 20 then
    raise exception 'Name must be 1 to 20 characters';
  end if;
  update public.profiles set display_name = v_name where user_id = v_uid;
  if not found then
    raise exception 'No profile';
  end if;
end;
$$;

-- Instant mutual friendship from a shared code. Idempotent: adding an
-- existing friend just returns their profile again.
create or replace function public.add_friend(p_code text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_friend public.profiles;
begin
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'No profile';
  end if;

  select * into v_friend from public.profiles where friend_code = v_code;
  if not found then
    raise exception 'Friend code not found';
  end if;
  if v_friend.user_id = v_uid then
    raise exception 'That is your own code';
  end if;

  insert into public.friendships (user_a, user_b)
  values (least(v_uid, v_friend.user_id), greatest(v_uid, v_friend.user_id))
  on conflict do nothing;

  return v_friend;
end;
$$;

create or replace function public.remove_friend(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  delete from public.friendships
  where user_a = least(v_uid, p_user_id)
    and user_b = greatest(v_uid, p_user_id);
end;
$$;

-- Presence heartbeat: stamp "I'm here" on the caller's profile. Deliberately
-- a silent no-op before the profile exists — the app fires this blind.
create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where user_id = auth.uid();
$$;

-- Batch upsert of the caller's own results — one RPC serves a single finish,
-- an offline-outbox flush and the first-run backfill. Every field is
-- re-validated here (the table checks are the backstop); date_key may run one
-- day ahead of the server to tolerate device-local timezones.
create or replace function public.publish_daily_results(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'No profile';
  end if;
  if p_results is null
     or jsonb_typeof(p_results) <> 'array'
     or jsonb_array_length(p_results) > 100 then
    raise exception 'Malformed results';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_results) r
    where coalesce(r->>'date_key', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or (r->>'date_key')::date > current_date + 1
       or coalesce(r->>'game', '') not in ('scout','tenball','journeyman','teamsheet')
       or coalesce(r->>'status', '') not in ('won','revealed','ongoing')
       or jsonb_typeof(r->'score') <> 'number'
       or (r->>'score')::numeric not between 0 and 500
       or (jsonb_typeof(r->'total') <> 'null'
           and (jsonb_typeof(r->'total') <> 'number'
                or (r->>'total')::numeric not in (10, 11)))
       or jsonb_typeof(r->'streak') <> 'number'
       or (r->>'streak')::numeric not between 0 and 10000
  ) then
    raise exception 'Malformed results';
  end if;

  insert into public.daily_results (user_id, date_key, game, status, score, total, streak)
  select
    v_uid,
    r->>'date_key',
    r->>'game',
    r->>'status',
    (r->>'score')::int,
    (r->>'total')::int,
    (r->>'streak')::int
  from jsonb_array_elements(p_results) r
  on conflict (user_id, date_key, game) do update
    set status = excluded.status,
        score = excluded.score,
        total = excluded.total,
        streak = excluded.streak,
        published_at = now()
    -- A finished day is final: a stale 'ongoing' row can never downgrade it.
    where daily_results.status = 'ongoing' or excluded.status <> 'ongoing';
end;
$$;

grant execute on function public.ensure_profile(text) to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.touch_presence() to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.publish_daily_results(jsonb) to authenticated;
