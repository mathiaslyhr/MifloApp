-- Miflo M2: rooms + players for the realtime quiz lobby.
--
-- Design notes:
--  * No login — players are anonymous Supabase users (auth.uid()).
--  * RLS is on for both tables. Members can READ their room + co-players; there
--    are NO insert/update policies — every write goes through a SECURITY DEFINER
--    RPC below, so the client can't forge rooms, scores, or memberships.
--  * Realtime is enabled on both tables; it respects the SELECT policies.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.rooms (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  host_id        uuid not null references auth.users (id) on delete cascade,
  status         text not null default 'lobby'
                   check (status in ('lobby', 'in_progress', 'finished')),
  topic_ids      text[] not null default '{}',
  question_count int not null default 10,
  -- The shared deck, set at start_game(); null while in the lobby.
  questions      jsonb,
  -- Phase fields for M4's synced loop; written but unused by the M3 client.
  current_index  int not null default 0,
  phase          text,
  phase_deadline timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  name      text not null,
  is_host   boolean not null default false,
  score     int not null default 0,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists players_room_id_idx on public.players (room_id);

-- ── Membership helper (SECURITY DEFINER avoids RLS recursion) ────────────────

create or replace function public.is_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.players
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.rooms enable row level security;
alter table public.players enable row level security;

drop policy if exists rooms_select_members on public.rooms;
create policy rooms_select_members on public.rooms
  for select using (public.is_member(id));

drop policy if exists players_select_members on public.players;
create policy players_select_members on public.players
  for select using (public.is_member(room_id));

-- ── Unique, readable room code (no 0/O/1/I) ──────────────────────────────────

create or replace function public.gen_code()
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
    for i in 1..4 loop
      candidate := candidate ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ── Write RPCs (all SECURITY DEFINER; bypass RLS in a controlled way) ─────────

create or replace function public.create_room(
  p_topic_ids text[],
  p_count int,
  p_name text
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.rooms (code, host_id, topic_ids, question_count)
  values (public.gen_code(), v_uid, coalesce(p_topic_ids, '{}'), coalesce(p_count, 10))
  returning * into v_room;

  insert into public.players (room_id, user_id, name, is_host)
  values (v_room.id, v_uid, p_name, true);

  return v_room;
end;
$$;

create or replace function public.join_room(
  p_code text,
  p_name text
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(p_code) and status = 'lobby';

  if v_room.id is null then
    raise exception 'Invalid or closed code';
  end if;

  insert into public.players (room_id, user_id, name, is_host)
  values (v_room.id, v_uid, p_name, false)
  on conflict (room_id, user_id)
  do update set name = excluded.name;

  return v_room;
end;
$$;

create or replace function public.start_game(
  p_room_id uuid,
  p_questions jsonb
)
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
      current_index = 0
  where id = p_room_id and host_id = v_uid and status = 'lobby';

  if not found then
    raise exception 'Only the host can start a room in the lobby';
  end if;
end;
$$;

create or replace function public.update_score(
  p_room_id uuid,
  p_score int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.players
  set score = p_score
  where room_id = p_room_id and user_id = v_uid;

  if not found then
    raise exception 'Not a member of this room';
  end if;
end;
$$;

grant execute on function public.create_room(text[], int, text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.start_game(uuid, jsonb) to authenticated;
grant execute on function public.update_score(uuid, int) to authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
