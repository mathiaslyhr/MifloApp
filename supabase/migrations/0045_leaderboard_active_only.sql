-- 0045: the ranked board lists PLAYERS, not leftovers.
--
-- Two bugs, one cause: a deleted account kept its € and went on ranking.
--
-- 1. rh_leaderboard joined profiles with a LEFT join (0044), so an account whose
--    profile was deleted stayed on the board as a nameless "Someone". The
--    reasoning was borrowed from rh_match_history (0041) — "a deleted opponent
--    should cost the match its name, not its place" — and it does not transfer.
--    A match history is a record of the PAST: that match happened, the opponent
--    was there, and erasing their row would falsify a fixture that was really
--    played. A leaderboard is a statement about the PRESENT: these are the
--    players. Someone who deleted their account is not one of them. 0030's
--    worldwide_leaderboard had this right with an inner join; 0044 broke it.
--
-- 2. delete_my_account (0028) is the reason such rows exist at all. It predates
--    ranked (0034) and still deletes only profiles/push_tokens/players, so its
--    own header — "wipes every row keyed to the caller's anonymous identity" —
--    stopped being true the moment player_ratings and rating_events appeared.
--    Deleting your account left your € standing, your whole match history and
--    your queue row on the server, and the board kept showing them. Fixed below:
--    5.1.1 means gone, and "gone" has to include the ranked footprint.
--
-- Note what this canNOT do: an abandoned-but-undeleted account is
-- indistinguishable from an active one. It has a profile, a recent last_seen_at
-- and recent matches. No filter here can identify it, and no time-based gate is
-- attempted (every rated account has played within the week). Removing one means
-- deleting its data.

-- ── 1. The board: profile or no place ────────────────────────────────────────

create or replace function public.rh_leaderboard(
  p_scope text default 'world',
  p_limit int default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int  := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_rows  jsonb;
  v_me    jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(p_scope, '') not in ('world', 'friends') then
    raise exception 'Malformed arguments';
  end if;

  with record as (
    -- The W/D/L split. The legacy fallback is spelled EXACTLY as
    -- rh_match_history (0041) spells it — a null result reads from the sign of
    -- the delta — because the career page and this board must never disagree
    -- about the same player's record.
    select
      user_id,
      count(*) filter (
        where coalesce(result, case when delta > 0 then 'win' else 'loss' end) = 'win'
      ) as wins,
      count(*) filter (where result = 'draw') as draws,
      count(*) filter (
        where coalesce(result, case when delta > 0 then 'win' else 'loss' end) = 'loss'
      ) as losses
    from public.rating_events
    group by user_id
  ),
  board as (
    select
      pr.user_id,
      p.display_name,
      p.avatar_path,
      pr.value,
      coalesce(r.wins, 0)   as wins,
      coalesce(r.draws, 0)  as draws,
      coalesce(r.losses, 0) as losses,
      rank() over (order by pr.value desc, pr.updated_at asc) as rnk
    from public.player_ratings pr
    -- INNER join: no profile, no place. A deleted account stops being a player
    -- the moment it is deleted, and the ranks below it close up behind it.
    join public.profiles p on p.user_id = pr.user_id
    left join record r on r.user_id = pr.user_id
    where pr.games > 0
      and (
        p_scope = 'world'
        or pr.user_id = v_uid
        or public.are_friends(pr.user_id, v_uid)
      )
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rank', rnk,
          'display_name', display_name,
          'avatar_path', avatar_path,
          'value', value,
          -- played is derived from the same three counts shown beside it, never
          -- from player_ratings.games, so the row is self-consistent by
          -- construction: 18 + 4 + 1 must always equal the 23 next to it.
          'played', wins + draws + losses,
          'wins', wins,
          'draws', draws,
          'losses', losses,
          'is_me', user_id = v_uid
        )
        order by rnk
      ) filter (where rnk <= v_limit),
      '[]'::jsonb
    ),
    (
      select jsonb_build_object(
        'rank', rnk,
        'value', value,
        'played', wins + draws + losses,
        'wins', wins,
        'draws', draws,
        'losses', losses
      )
      from board
      where user_id = v_uid
    )
  into v_rows, v_me
  from board;

  return jsonb_build_object('rows', v_rows, 'me', v_me);
end;
$$;

revoke execute on function public.rh_leaderboard(text, int) from public, anon;
grant execute on function public.rh_leaderboard(text, int) to authenticated;

-- ── 2. Delete means delete ───────────────────────────────────────────────────
-- Adds the three ranked tables keyed to auth.uid(). rating_events is the
-- caller's OWN half of each match (both players hold a row per match_id), so
-- dropping it leaves every opponent's history intact — their row survives, and
-- rh_match_history's self-join simply finds no counterpart and reads the match
-- back as "Someone". That is exactly the fallback 0041 built and documented.
-- ranked_elo_log is keyed by match_id, not by user, and is left alone: it is the
-- once-per-match idempotency guard, and forgetting a settled match would let it
-- settle twice.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.push_tokens    where user_id = v_uid;
  delete from public.players        where user_id = v_uid;
  -- The ranked footprint (0034/0037/0041): the € standing, every match's delta
  -- and any live queue row. Without these, a deleted account kept ranking.
  delete from public.ranked_queue   where user_id = v_uid;
  delete from public.rating_events  where user_id = v_uid;
  delete from public.player_ratings where user_id = v_uid;
  -- Cascades friendships, daily_results and friend_requests.
  delete from public.profiles       where user_id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
