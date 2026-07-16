-- 0044: rh_leaderboard — Competitive's board, the transfer-market rich list.
--
-- Play → Competitive has had a Leaderboard button since the ranked lane shipped,
-- wired to a "coming soon" toast. This is what it opens.
--
-- Ranking is by player_ratings.value, and that was never really an open choice:
-- value is already an ELO denominated in euros (0037/0041), so it is
-- opponent-weighted and self-correcting. Ranking by wins would reward grinding;
-- by win rate would put a 3-0 newcomer on top. Value resists both — a win at
-- parity pays ~+€2.5M off a €10M start, so the top of the board is earned over
-- dozens of matches, not bought with a lucky night.
--
-- Two scopes off one function: 'world' (everyone who has played) and 'friends'
-- (you + are_friends, ranked among yourselves, 1..N).
--
-- Privacy: this returns a ranked stranger's display name and avatar, stepping
-- around the friend-scoped profiles RLS — the same trade worldwide_leaderboard
-- (0030) and rh_match_history (0041) already make, and for the same reason: a
-- public board needs a name and a face. Nothing else from profiles crosses:
-- no friend code, no favorites, no presence. Other players' user_id is
-- deliberately NOT returned; `is_me` is all the UI needs to tint the caller's
-- own row, so no id leaves the server.
--
-- No inactivity gate, on purpose. An ELO board eventually gets squatted by
-- someone who peaked and quit, and the usual fix is to drop the idle (Lichess
-- does). At this app's size that could empty the board, so it stays off —
-- player_ratings.updated_at is a true last-match timestamp, which makes the
-- gate a one-line WHERE the day squatting is actually real.

-- The board sorts by value desc and tiebreaks on updated_at, so index it that
-- way (0030 added daily_results_game_date_idx for exactly this reason).
create index if not exists player_ratings_value_idx
  on public.player_ratings (value desc, updated_at asc);

-- Returns { rows: [ {rank, display_name, avatar_path, value, played,
--                    wins, draws, losses, is_me} … ],
--           me:   {rank, value, played, wins, draws, losses} | null }
--
-- rows is the top p_limit (default 10, clamped 1..100); me is the caller's own
-- ranked row even when it falls outside that slice, so the UI can pin "You ·
-- 84th" under the board. me is null when the caller has never played a ranked
-- match — there is no player_ratings row until rh_settle_value writes one, so
-- an unplayed account is genuinely absent rather than sitting at a phantom €10M.
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
    -- LEFT join, unlike worldwide_leaderboard's inner one, and for the reason
    -- rh_match_history (0041) gives: a deleted profile should cost a player
    -- their name, not their place. A board is a record of who beat whom — an
    -- account that earned €62M over 20 matches and then deleted its profile
    -- shouldn't silently promote everyone below it. The client renders the
    -- nameless with the same "unknown player" fallback the history list uses.
    -- It also keeps `me` resolving for a caller who has no profile: their own
    -- row says "You", so it never needed a display name to begin with.
    left join public.profiles p on p.user_id = pr.user_id
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
