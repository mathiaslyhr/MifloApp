-- 0043: the friend directory — browsing past your own friends list.
--
-- Today a profile page is a cul-de-sac: profiles_select (0020) hides anyone who
-- isn't you or a direct friend, and friendships_select only returns rows you
-- are personally in. So "tap a friend, see who THEY know, go look" — the thing
-- people keep asking for — is unreachable from the client at any price. These
-- are the two SECURITY DEFINER reads that open it, in the same shape as the
-- other cross-user reads (are_friends 0020, friend_count 0025,
-- worldwide_leaderboard 0030, rh_friend_career 0042).
--
-- The product decision behind the split: you may browse a FRIEND's friend list,
-- and a stranger you find there gets an identity page with an Add friend button
-- — never their career, never their dailies. So:
--
--   friends_of     friend-gated (you can't enumerate a stranger's network)
--   public_profile  open to any signed-in user (it IS the stranger page)
--
-- Privacy, stated plainly: public_profile widens `favorite_*` and the friend
-- COUNT from friends-only to any authenticated caller. That is a real widening
-- and it was taken deliberately — favourites are self-chosen showcase items, a
-- count is a number, and 0030 already publishes display_name + avatar_path to
-- strangers worldwide. What still never crosses to a non-friend: friend_code
-- (it grants friendship), last_seen_at (presence), daily results, and the €
-- career (0042 keeps its own are_friends gate). 0025's friend_count stays as
-- it is — it still serves the friend path and costs nothing.

-- ── friends_of: who does this person know ────────────────────────────────────
-- Returns [ {user_id, display_name, avatar_path, is_friend} … ], name-sorted so
-- the list is stable between visits. `is_friend` is the caller's own relation to
-- each row, which is what lets the UI mark mutuals and decide whether a tap
-- lands on a full profile or a stranger page.
--
-- Deliberately NOT returned: friend_code, last_seen_at, favourites. A list is a
-- list; the page you land on is what fetches the person.

create or replace function public.friends_of(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is null then
    raise exception 'No user';
  end if;
  -- Self or a direct friend. Anyone else is told no, rather than handed an
  -- empty list — an empty list would read as "they have no friends".
  if p_user_id <> v_uid and not public.are_friends(v_uid, p_user_id) then
    raise exception 'Not friends';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', f.user_id,
        'display_name', f.display_name,
        'avatar_path', f.avatar_path,
        'is_friend', f.is_friend
      )
      order by lower(f.display_name), f.user_id
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      p.user_id,
      p.display_name,
      p.avatar_path,
      -- You are your own "friend" for UI purposes: tapping yourself in a
      -- friend's list should open a real profile, not an Add friend page.
      (p.user_id = v_uid or public.are_friends(v_uid, p.user_id)) as is_friend
    from public.friendships fr
    join public.profiles p
      on p.user_id = case when fr.user_a = p_user_id then fr.user_b else fr.user_a end
    where p_user_id in (fr.user_a, fr.user_b)
  ) f;

  return v_rows;
end;
$$;

revoke execute on function public.friends_of(uuid) from public, anon;
grant execute on function public.friends_of(uuid) to authenticated;

-- ── public_profile: the stranger page's one read ─────────────────────────────
-- Returns { user_id, display_name, avatar_path, favorite_player_id,
--           favorite_club_id, favorite_nation, friend_count, is_friend }
--
-- `is_friend` is the authority the client trusts: the row that opened this page
-- carried a hint, but friendship can change between the tap and the fetch (you
-- accepted their request in the meantime), so the page re-asks and corrects
-- itself. Null for a user_id that doesn't exist, so a deleted profile reads as
-- absent rather than as an empty person.

create or replace function public.public_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is null then
    raise exception 'No user';
  end if;

  select jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_path', p.avatar_path,
    'favorite_player_id', p.favorite_player_id,
    'favorite_club_id', p.favorite_club_id,
    'favorite_nation', p.favorite_nation,
    'friend_count', (select count(*)::int from public.friendships
                     where p.user_id in (user_a, user_b)),
    'is_friend', (p.user_id = v_uid or public.are_friends(v_uid, p.user_id))
  )
  into v_row
  from public.profiles p
  where p.user_id = p_user_id;

  return v_row;
end;
$$;

revoke execute on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;

-- ── search_profiles: find someone by the name you know them by ───────────────
-- Adding a friend used to mean knowing their six-character code, because
-- profiles_select hides everyone who isn't already a friend — so typing a
-- person's actual name found nothing, and said "no matches" as if they didn't
-- exist. Display names are globally unique (0027), so a name is an identifier
-- in exactly the way a code is; this makes it usable as one.
--
-- Returns the same rows as friends_of, so both feed one list on the client.
-- Same fields, same limits: no friend_code (you don't get to skip the request
-- by finding someone), no presence, no favourites.
--
-- Exact match sorts first, then prefix, then the rest — so searching a whole
-- name lands on that person even when they share a stem with others.
--
-- The escaping is load-bearing, not defensive: `_` and `%` are LIKE wildcards,
-- and a real user is named "_". Unescaped, their search would match the entire
-- table and theirs would be the one row hardest to find.

create or replace function public.search_profiles(
  p_query text,
  p_limit int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_q     text := btrim(coalesce(p_query, ''));
  v_esc   text;
  v_limit int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_rows  jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  -- An empty query means "everyone", which is a directory dump, not a search.
  if v_q = '' then
    return '[]'::jsonb;
  end if;

  v_esc := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', f.user_id,
        'display_name', f.display_name,
        'avatar_path', f.avatar_path,
        'is_friend', f.is_friend
      )
      order by f.exact desc, f.prefix desc, lower(f.display_name), f.user_id
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      p.user_id,
      p.display_name,
      p.avatar_path,
      public.are_friends(v_uid, p.user_id) as is_friend,
      (lower(p.display_name) = lower(v_q)) as exact,
      (p.display_name ilike v_esc || '%' escape '\') as prefix
    from public.profiles p
    where p.user_id <> v_uid
      and p.display_name ilike '%' || v_esc || '%' escape '\'
    order by
      (lower(p.display_name) = lower(v_q)) desc,
      (p.display_name ilike v_esc || '%' escape '\') desc,
      lower(p.display_name)
    limit v_limit
  ) f;

  return v_rows;
end;
$$;

revoke execute on function public.search_profiles(text, int) from public, anon;
grant execute on function public.search_profiles(text, int) to authenticated;
