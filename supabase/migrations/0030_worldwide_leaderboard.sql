-- 0030: worldwide_leaderboard — the app's first cross-user read surface.
--
-- The Friends tab already compares your four daily games against friends only
-- (daily_results RLS = own rows + friends' rows). This adds a public board:
-- for one game on one day, who did best. "Best" is the same right/wrong the
-- Log already speaks — most right, then fewest tries — so one ORDER BY serves
-- both game families:
--   * scout/journeyman: total is 1 (won) or 0, so solvers float up, then the
--     fewest non-winning guesses (score) win the tie;
--   * tenball/teamsheet: most found (total) first, then the fewest misses.
--   * published_at asc is the final, deterministic tiebreak (finished first).
-- Only finished rows count (won/revealed); a live 'ongoing' row is excluded.
--
-- Like the other cross-user reads (are_friends, friend_count), this is a
-- SECURITY DEFINER RPC that deliberately steps around the friend-scoped RLS.
-- Nothing here can spoil a puzzle: the board carries display name, avatar and
-- the score-level counts only, never an answer. Visibility is public by design
-- (every opted-in profile is rankable) — the product decision for v1.

-- The board query filters by (game, date_key) and sorts by total/score, so a
-- covering index keyed that way keeps it cheap as daily_results grows.
create index if not exists daily_results_game_date_idx
  on public.daily_results (game, date_key, total desc, score, published_at);

-- Returns { rows: [ {rank, display_name, avatar_path, status, score, total,
--                     is_me} … ],
--           me:   {rank, status, score, total} | null }
-- rows is the top p_limit (default 50, clamped 1..100); me is the caller's own
-- ranked row even when it falls outside that slice, so the UI can pin "You ·
-- 128th". Other players' user_id is deliberately not returned — the board only
-- needs a name and a face; `is_me` lets the UI highlight the caller's own row
-- inside the slice without exposing anyone's id.
create or replace function public.worldwide_leaderboard(
  p_date_key text,
  p_game text,
  p_limit int default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int  := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows  jsonb;
  v_me    jsonb;
begin
  if coalesce(p_date_key, '') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(p_game, '') not in ('scout', 'tenball', 'journeyman', 'teamsheet') then
    raise exception 'Malformed arguments';
  end if;

  with ranked as (
    select
      dr.user_id,
      p.display_name,
      p.avatar_path,
      dr.status,
      dr.score,
      dr.total,
      rank() over (
        order by dr.total desc, dr.score asc, dr.published_at asc
      ) as rnk
    from public.daily_results dr
    join public.profiles p on p.user_id = dr.user_id
    where dr.date_key = p_date_key
      and dr.game = p_game
      and dr.status in ('won', 'revealed')
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rank', rnk,
          'display_name', display_name,
          'avatar_path', avatar_path,
          'status', status,
          'score', score,
          'total', total,
          'is_me', user_id = v_uid
        )
        order by rnk
      ) filter (where rnk <= v_limit),
      '[]'::jsonb
    ),
    (
      select jsonb_build_object(
        'rank', rnk, 'status', status, 'score', score, 'total', total
      )
      from ranked
      where user_id = v_uid
    )
  into v_rows, v_me
  from ranked;

  return jsonb_build_object('rows', v_rows, 'me', v_me);
end;
$$;

revoke execute on function public.worldwide_leaderboard(text, text, int) from public, anon;
grant execute on function public.worldwide_leaderboard(text, text, int) to authenticated;
