-- 0049: Ball Knowledge — the fan-group competition.
--
-- Favorites (0029) say who you support; daily_results (0020/0022/0027) say how
-- you actually play. This joins the two into one number per fan base: which
-- club's fans, which country's fans, know ball.
--
-- The metric, in one sentence: Ball Knowledge is the share of your answers
-- that are right, 0..100, across the dailies you actually played.
--   * A daily counts only when it is finished (won/revealed — 0030's rule; an
--     'ongoing' row is a half-played game, and an abandoned one would drag a
--     group down forever) AND has at least one recorded answer
--     (coalesce(total,0) + score > 0 — this also drops pre-0027 rows where
--     total is null and score is 0).
--   * Surrender carries no extra penalty: giving up already costs the rights
--     you never got (a surrendered Scout day is 0/…). Some players just want
--     to see the answer; the metric shouldn't punish that twice.
--   * A perfect day carries no bonus: all right and nothing wrong is already
--     100, the top of the scale.
--
-- A group's number is the AVERAGE of its members' Ball Knowledge, not
-- pooled sum(rights)/sum(answers). Pooling weights by volume — one grinder
-- with 120 dailies would outvote five fans with 10 each, and the board would
-- measure "who has the busiest superfan" instead of "which fan base knows
-- ball". Per-capita is the claim the feature makes, so per-capita it is.
--
-- Two tunable floors keep the averages honest (declared at the top of each
-- RPC body — tune them there, in BOTH functions, one-line migration):
--   * member floor (3): a member counts for their group once they have played
--     3 dailies in the month, so one lucky guess can't swing a group;
--   * group floor (2): a group boards with 2 counted members. The duel
--     deliberately skips this one — a below-floor side renders as "not enough
--     counted fans", not as absent.
--
-- Period is the calendar month, so every board is a season with a winner:
-- the previous month's champion rides along in the board payload.
--
-- Privacy: same trade as worldwide_leaderboard (0030) and rh_leaderboard
-- (0044), except this board is aggregates only — no display name, no avatar,
-- and no user_id ever crosses the wire. Rows are fan GROUPS; `is_mine`/`me`
-- are all the UI needs to tint the caller's own group.

-- Both RPCs scan a month of daily_results across all users and games. The
-- existing indexes lead on user_id (PK, 0020) or game (0030), so neither
-- serves a date-range-first scan; this one does.
create index if not exists daily_results_date_idx
  on public.daily_results (date_key);

-- The ONE definition of the math, shared by board (current month), board
-- (previous-month winner) and duel — so the aggregation can never fork.
-- Returns every group with at least one counted member; callers apply their
-- own group floor. Not callable by clients (revoked below); the RPCs are the
-- only doors.
create or replace function public.bk_groups(
  p_dimension text,   -- 'club' | 'nation' (validated by the callers)
  p_from text,        -- 'YYYY-MM-DD' inclusive
  p_to text,          -- 'YYYY-MM-DD' exclusive (first day of the next month)
  p_min_played int    -- member floor: played dailies before a member counts
)
returns table (group_id text, bk numeric, members int, rights bigint, wrongs bigint)
language sql
stable
security definer
set search_path = public
as $$
  with played as (
    select
      dr.user_id,
      sum(coalesce(dr.total, 0)) as rights,
      sum(dr.score)              as wrongs,
      count(*)                   as played
    from public.daily_results dr
    where dr.date_key >= p_from
      and dr.date_key < p_to
      and dr.status in ('won', 'revealed')
      and coalesce(dr.total, 0) + dr.score > 0
    group by dr.user_id
  ),
  counted as (
    -- Inner join: no profile, no fan group (a deleted account cascades its
    -- results away anyway — 0048).
    select
      case when p_dimension = 'club' then p.favorite_club_id
           else p.favorite_nation end as group_id,
      pl.rights,
      pl.wrongs,
      pl.rights::numeric / (pl.rights + pl.wrongs) * 100 as member_bk
    from played pl
    join public.profiles p on p.user_id = pl.user_id
    where pl.played >= p_min_played
      and (case when p_dimension = 'club' then p.favorite_club_id
                else p.favorite_nation end) is not null
  )
  select
    group_id,
    round(avg(member_bk), 1) as bk,
    count(*)::int            as members,
    sum(rights)              as rights,
    sum(wrongs)              as wrongs
  from counted
  group by group_id
$$;

revoke execute on function public.bk_groups(text, text, text, int)
  from public, anon, authenticated;

-- Returns { rows: [ {rank, group_id, bk, members, is_mine} … ],
--           me:   { group_id, rank|null, group_bk|null, group_members,
--                   my_bk|null, my_played, counted } | null,
--           previous_winner: {month_key, group_id, bk, members} | null }
--
-- rows is EVERY group over the group floor, ranked — the population is
-- bounded by distinct favorite clubs/nations, so no p_limit. me is null when
-- the caller has no favorite for this dimension; me.rank is null when their
-- group is below the group floor (the UI's "needs more fans" state); me.counted
-- says whether the caller themself has met the member floor yet.
create or replace function public.ball_knowledge_board(
  p_dimension text,
  p_month_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min_played  int := 3;  -- member floor; keep in sync with ball_knowledge_duel
  v_min_members int := 2;  -- group floor
  v_uid       uuid := auth.uid();
  v_from      text;
  v_to        text;
  v_prev_from text;
  v_prev_key  text;
  v_group     text;
  v_rows      jsonb;
  v_me        jsonb;
  v_winner    jsonb;
  v_my_rank   int;
  v_my_group_bk numeric;
  v_my_group_members int;
  v_my_rights bigint;
  v_my_wrongs bigint;
  v_my_played int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(p_dimension, '') not in ('club', 'nation')
     or coalesce(p_month_key, '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Malformed arguments';
  end if;

  v_from      := p_month_key || '-01';
  v_to        := to_char(v_from::date + interval '1 month', 'YYYY-MM-DD');
  v_prev_from := to_char(v_from::date - interval '1 month', 'YYYY-MM-DD');
  v_prev_key  := substr(v_prev_from, 1, 7);

  select case when p_dimension = 'club' then p.favorite_club_id
              else p.favorite_nation end
  into v_group
  from public.profiles p
  where p.user_id = v_uid;

  -- One pass over the month's groups: the ranked board (group floor applied)
  -- and the caller's group looked up in the same set. A below-floor group is
  -- absent from `ranked` but present in `groups`, so its rank comes back null
  -- while its bk/members still fill `me` — the UI's "needs more fans" state.
  with groups as (
    select * from public.bk_groups(p_dimension, v_from, v_to, v_min_played)
  ),
  ranked as (
    select
      g.group_id,
      g.bk,
      g.members,
      rank() over (order by g.bk desc, g.members desc, g.group_id asc) as rnk
    from groups g
    where g.members >= v_min_members
  )
  select
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'rank', r.rnk,
            'group_id', r.group_id,
            'bk', r.bk,
            'members', r.members,
            'is_mine', r.group_id is not distinct from v_group
          )
          order by r.rnk
        ),
        '[]'::jsonb
      )
      from ranked r
    ),
    (select r.rnk from ranked r where r.group_id = v_group),
    (select g.bk from groups g where g.group_id = v_group),
    (select g.members from groups g where g.group_id = v_group)
  into v_rows, v_my_rank, v_my_group_bk, v_my_group_members;

  if v_group is not null then
    -- The caller's own month, straight off their rows (their group's aggregate
    -- may exclude them while they are under the member floor).
    select
      coalesce(sum(coalesce(dr.total, 0)), 0),
      coalesce(sum(dr.score), 0),
      count(*)::int
    into v_my_rights, v_my_wrongs, v_my_played
    from public.daily_results dr
    where dr.user_id = v_uid
      and dr.date_key >= v_from
      and dr.date_key < v_to
      and dr.status in ('won', 'revealed')
      and coalesce(dr.total, 0) + dr.score > 0;

    v_me := jsonb_build_object(
      'group_id', v_group,
      'rank', v_my_rank,
      'group_bk', v_my_group_bk,
      'group_members', coalesce(v_my_group_members, 0),
      'my_bk', case
        when v_my_rights + v_my_wrongs > 0
        then round(v_my_rights::numeric / (v_my_rights + v_my_wrongs) * 100, 1)
        else null
      end,
      'my_played', v_my_played,
      'counted', v_my_played >= v_min_played
    );
  end if;

  select jsonb_build_object(
    'month_key', v_prev_key,
    'group_id', w.group_id,
    'bk', w.bk,
    'members', w.members
  )
  into v_winner
  from public.bk_groups(p_dimension, v_prev_from, v_from, v_min_played) w
  where w.members >= v_min_members
  order by w.bk desc, w.members desc, w.group_id asc
  limit 1;

  return jsonb_build_object(
    'rows', v_rows,
    'me', v_me,
    'previous_winner', v_winner
  );
end;
$$;

revoke execute on function public.ball_knowledge_board(text, text) from public, anon;
grant execute on function public.ball_knowledge_board(text, text) to authenticated;

-- Returns { a: {group_id, bk, members, rights, wrongs} | null, b: { … } | null }
-- A null side means zero counted fans this month — the UI's "not enough
-- counted fans" state. No group floor here, on purpose: a duel against a small
-- fan base should show the small fan base, not pretend it doesn't exist.
-- Unknown ids are harmless — they match nothing and come back null.
create or replace function public.ball_knowledge_duel(
  p_dimension text,
  p_side_a text,
  p_side_b text,
  p_month_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min_played int := 3;  -- member floor; keep in sync with ball_knowledge_board
  v_from text;
  v_to   text;
  v_a    jsonb;
  v_b    jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(p_dimension, '') not in ('club', 'nation')
     or coalesce(p_month_key, '') !~ '^\d{4}-(0[1-9]|1[0-2])$'
     or coalesce(p_side_a, '') = '' or length(p_side_a) > 64
     or coalesce(p_side_b, '') = '' or length(p_side_b) > 64 then
    raise exception 'Malformed arguments';
  end if;

  v_from := p_month_key || '-01';
  v_to   := to_char(v_from::date + interval '1 month', 'YYYY-MM-DD');

  select jsonb_build_object(
    'group_id', g.group_id, 'bk', g.bk, 'members', g.members,
    'rights', g.rights, 'wrongs', g.wrongs
  )
  into v_a
  from public.bk_groups(p_dimension, v_from, v_to, v_min_played) g
  where g.group_id = p_side_a;

  select jsonb_build_object(
    'group_id', g.group_id, 'bk', g.bk, 'members', g.members,
    'rights', g.rights, 'wrongs', g.wrongs
  )
  into v_b
  from public.bk_groups(p_dimension, v_from, v_to, v_min_played) g
  where g.group_id = p_side_b;

  return jsonb_build_object('a', v_a, 'b', v_b);
end;
$$;

revoke execute on function public.ball_knowledge_duel(text, text, text, text) from public, anon;
grant execute on function public.ball_knowledge_duel(text, text, text, text) to authenticated;
