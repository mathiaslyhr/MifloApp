-- Miflo: profile pictures. A user picks a photo from their library; it uploads
-- to a public storage bucket and becomes their avatar everywhere their identity
-- shows: their own Profile tab, friends' feeds/requests, and the party lobby.
--
-- Design notes:
--  * Storage is a PUBLIC bucket (mirrors 0016_game_data_bucket.sql): clients read
--    over the public object URL, so no read policy on storage.objects is needed.
--    Unlike game-data, users WRITE their own avatar, so owner-write policies are
--    required — but postgres does not own storage.objects on hosted Supabase, so
--    those three policies must be created in the Supabase SQL editor (as the
--    table owner), NOT assumed from this migration. They are included below and
--    are idempotent; running them here is a no-op where postgres lacks ownership,
--    and they succeed when pasted into the SQL editor. Path convention:
--      avatars/<auth.uid()>/avatar.jpg   (owner-scoped by the leading uid folder)
--  * profiles.avatar_path stores the object KEY, not a URL — the client derives
--    the public URL at render time (getPublicUrl) and cache-busts on re-upload.
--  * The lobby cannot resolve avatars from profiles by user_id: profiles_select
--    (0020) only exposes you + friends + pending-request counterparts, and party
--    guests are often strangers. So avatar_path is DENORMALIZED onto the players
--    row, stamped from the caller's own profile at create/join/rename time.
--
-- Same caveat as 0020: a lost anon session orphans the old avatar object.

-- ── Storage bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Owner-write policies. See the note above: create these in the SQL editor if
-- this migration cannot (postgres not owning storage.objects). Public read needs
-- no policy on a public bucket.
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── profiles.avatar_path + setter ─────────────────────────────────────────────

alter table public.profiles
  add column if not exists avatar_path text;

-- Set (or clear, with null) the caller's avatar object key. Mirrors
-- set_display_name (0020): SECURITY DEFINER, authenticated-only.
create or replace function public.set_avatar_path(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.profiles set avatar_path = p_path where user_id = v_uid;
  if not found then
    raise exception 'No profile';
  end if;
end;
$$;

revoke execute on function public.set_avatar_path(text) from public, anon;
grant execute on function public.set_avatar_path(text) to authenticated;

-- ── players.avatar_path (denormalized for the lobby roster) ───────────────────

alter table public.players
  add column if not exists avatar_path text;

-- Re-create the three player-writing RPCs so each stamps the caller's current
-- profile avatar onto the players row. Signatures are unchanged, so no
-- drop-function is needed. Guests without a profile simply get null → the
-- client falls back to initials.

create or replace function public.create_room(
  p_topic_ids text[],
  p_count int,
  p_name text,
  p_game_type text default 'quiz'
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_room   public.rooms;
  v_avatar text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select avatar_path into v_avatar from public.profiles where user_id = v_uid;

  insert into public.rooms (code, host_id, topic_ids, question_count, game_type)
  values (
    public.gen_code(),
    v_uid,
    coalesce(p_topic_ids, '{}'),
    coalesce(p_count, 10),
    coalesce(p_game_type, 'quiz')
  )
  returning * into v_room;

  insert into public.players (room_id, user_id, name, is_host, avatar_path)
  values (v_room.id, v_uid, p_name, true, v_avatar);

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
  v_uid    uuid := auth.uid();
  v_room   public.rooms;
  v_avatar text;
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

  select avatar_path into v_avatar from public.profiles where user_id = v_uid;

  insert into public.players (room_id, user_id, name, is_host, avatar_path)
  values (v_room.id, v_uid, p_name, false, v_avatar)
  on conflict (room_id, user_id)
  do update set name = excluded.name, avatar_path = excluded.avatar_path;

  return v_room;
end;
$$;

create or replace function public.rename_player(
  p_room_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := btrim(coalesce(p_name, ''));
  v_avatar text;
begin
  if v_name = '' then
    raise exception 'Name required';
  end if;

  select avatar_path into v_avatar from public.profiles where user_id = v_uid;

  update public.players
  set name = left(v_name, 20),
      avatar_path = v_avatar
  where room_id = p_room_id and user_id = v_uid;

  if not found then
    raise exception 'Not a member of this room';
  end if;
end;
$$;

grant execute on function public.create_room(text[], int, text, text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.rename_player(uuid, text) to authenticated;
