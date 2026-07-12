-- Miflo: profile "favorites" showcase. A user picks a favorite footballer,
-- club and national team; the trio shows on their own Profile tab and, because
-- profiles_select (0020) already exposes friends' rows, on their friends'
-- profile pages too. No lobby/denormalization: this is Profile-only, so unlike
-- avatars (0026) nothing is stamped onto the players roster.
--
-- Stored as the stable string ids the dataset already uses:
--   favorite_player_id  — footballer id ('Surname, First')
--   favorite_club_id    — club slug ('man-city')
--   favorite_nation     — nation string ('England')
-- The client resolves ids → names/art at render time (getById/getClub/flagImage),
-- the same denormalization philosophy as avatar_path. All three are nullable so
-- any single favorite can be cleared independently.

alter table public.profiles
  add column if not exists favorite_player_id text,
  add column if not exists favorite_club_id   text,
  add column if not exists favorite_nation    text;

-- Set (or clear, each with null) the caller's three favorites in one call.
-- Mirrors set_avatar_path (0026): SECURITY DEFINER, authenticated-only,
-- keyed on auth.uid().
create or replace function public.set_favorites(
  p_player text,
  p_club   text,
  p_nation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.profiles
  set favorite_player_id = p_player,
      favorite_club_id   = p_club,
      favorite_nation    = p_nation
  where user_id = v_uid;
  if not found then
    raise exception 'No profile';
  end if;
end;
$$;

revoke execute on function public.set_favorites(text, text, text) from public, anon;
grant execute on function public.set_favorites(text, text, text) to authenticated;
