-- Unique display names (case-insensitive).
--
-- Adding a friend is by code, so names don't need to be unique for
-- correctness — but two people both called "Ban100" is confusing. Enforce
-- one owner per name, case-insensitively ("Ban100" blocks "ban100"), in the
-- authoritative place (the DB) plus a friendly error the app can catch.
--
-- NOTE: if the profiles table already holds duplicate names this index will
-- fail to create — dedupe those rows first. (Pre-launch: likely none.)

create unique index if not exists profiles_display_name_lower_key
  on public.profiles (lower(btrim(display_name)));

-- Recreate ensure_profile so a NEW profile with a taken name raises a clean
-- `name_taken` (existing profiles are still returned untouched — idempotent).
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

  -- Already have a profile? Return it untouched — never renames, so a retry
  -- with a different name is a no-op (rename lives in set_display_name).
  select * into v_row from public.profiles where user_id = v_uid;
  if found then
    return v_row;
  end if;

  -- New profile: the name must be free (the unique index is the real guard;
  -- this pre-check just yields a friendly error on the common path).
  if exists (
    select 1 from public.profiles
    where lower(btrim(display_name)) = lower(v_name)
  ) then
    raise exception 'name_taken';
  end if;

  begin
    insert into public.profiles (user_id, display_name, friend_code)
    values (v_uid, v_name, public.gen_friend_code())
    on conflict (user_id) do nothing;
  exception when unique_violation then
    -- Lost a race for the name between the pre-check and the insert.
    raise exception 'name_taken';
  end;

  select * into v_row from public.profiles where user_id = v_uid;
  return v_row;
end;
$$;

-- Recreate set_display_name so a rename onto a taken name raises `name_taken`.
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

  if exists (
    select 1 from public.profiles
    where user_id <> v_uid
      and lower(btrim(display_name)) = lower(v_name)
  ) then
    raise exception 'name_taken';
  end if;

  begin
    update public.profiles set display_name = v_name where user_id = v_uid;
  exception when unique_violation then
    raise exception 'name_taken';
  end;

  if not found then
    raise exception 'No profile';
  end if;
end;
$$;
