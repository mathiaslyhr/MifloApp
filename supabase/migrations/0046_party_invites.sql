-- 0046: a party invite leaves a trace.
--
-- Until now an invite existed ONLY as an APNs push. Dismiss the banner and it
-- was gone: no in-app record, nothing to come back to. If notifications were
-- off it never existed at all. That is the whole reason the Home bell exists,
-- so send-party-invite writes this row even when the push fails — a log that
-- depends on push delivery is not a log.
--
-- The read model is a LOG, not an inbox. It says what happened ("Lars invited
-- you, you joined") and stays actionable only in the one case that matters: the
-- room is still open and you never turned up.
--
-- Nothing here guesses:
--   joined   — you joined a room iff you have a players row for it. Read, not inferred.
--   joinable — reuses join_room's OWN condition (status = 'lobby'), so the feed
--              can never offer a Join that join_room would then reject.
-- close_stale_room (0019) already flips abandoned rooms via the host heartbeat,
-- so dead rooms fall out of `joinable` on their own with nothing to schedule.

create table if not exists public.party_invites (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id   uuid not null references auth.users (id) on delete cascade,
  room_id      uuid not null references public.rooms (id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- The only read pattern: my invites, newest first.
create index if not exists party_invites_to_user_idx
  on public.party_invites (to_user_id, created_at desc);

alter table public.party_invites enable row level security;

-- Recipients read their own, and only their own. Nobody writes from the client:
-- the edge function inserts with the service key, exactly like the push it
-- sends. A client-writable invite log would be a client-forgeable one.
drop policy if exists party_invites_select_own on public.party_invites;
create policy party_invites_select_own on public.party_invites
  for select using (auth.uid() = to_user_id);

create or replace function public.my_party_invites(p_limit int default 30)
returns jsonb
language plpgsql
-- volatile, not stable: it sweeps its own expired rows below.
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int  := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_rows  jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- The log is a log, not an archive. Swept on read, so there is no cron to own
  -- and no job to forget. Only ever the caller's own rows.
  delete from public.party_invites
   where to_user_id = v_uid
     and created_at < now() - interval '7 days';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'created_at', i.created_at,
        'from_user_id', i.from_user_id,
        'display_name', p.display_name,
        'avatar_path', p.avatar_path,
        'code', r.code,
        'joined', pl.user_id is not null,
        -- join_room accepts a code only `where code = upper(p_code) and
        -- status = 'lobby'`. Matching that exactly is what stops the feed
        -- offering a Join that would bounce.
        'joinable', r.status = 'lobby' and pl.user_id is null
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select *
      from public.party_invites
     where to_user_id = v_uid
     order by created_at desc
     limit v_limit
  ) i
  -- INNER on rooms: an invite whose room is gone is not an invite any more.
  join public.rooms r on r.id = i.room_id
  -- LEFT on the host: a deleted account costs the row its name, not its place.
  -- Same rule rh_match_history (0041) uses for a gone opponent — this is a
  -- record of something that really happened, unlike the leaderboard (0045),
  -- which is a statement about the present and drops them.
  left join public.profiles p on p.user_id = i.from_user_id
  left join public.players pl on pl.room_id = i.room_id and pl.user_id = v_uid;

  return v_rows;
end;
$$;

revoke execute on function public.my_party_invites(int) from public, anon;
grant execute on function public.my_party_invites(int) to authenticated;
