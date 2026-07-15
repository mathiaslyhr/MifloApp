-- 0042: rh_friend_career — a friend's career page, read by you.
--
-- The Profile tab shows your € curve, your record and the matches behind it
-- (0041). A friend's profile now shows the same page about them, and nothing
-- in the schema could answer it: rh_match_history is hard-scoped to auth.uid(),
-- rating_events is select-own under RLS, and player_ratings is select-own too.
-- So this is the friend-scoped twin of rh_match_history: same payload, plus the
-- € standing the own page reads straight from player_ratings.
--
-- Gating: are_friends(caller, target) (0020). Not friends → exception, the same
-- answer a stranger gets from every other friend-scoped read. Self is allowed
-- and simply works, so the client never has to special-case looking at itself.
--
-- Privacy: this hands a friend's ranked opponents' display names and avatars to
-- someone who may not be friends with THEM. That is not a new class of
-- exposure — worldwide_leaderboard (0030) already publishes exactly those two
-- fields for every opted-in profile, and rh_match_history (0041) already hands
-- them to a ranked opponent. Nothing else from profiles crosses: no friend
-- code, no favorites, no presence. The daily archive on the same page stays on
-- the friend-scoped daily_results RLS it always used.

create or replace function public.rh_friend_career(
  p_user_id uuid,
  p_limit int default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_limit   int  := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_matches jsonb;
  v_record  jsonb;
  v_value   bigint;
  v_games   int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is null then
    raise exception 'No user';
  end if;
  if p_user_id <> v_uid and not public.are_friends(v_uid, p_user_id) then
    raise exception 'Not friends';
  end if;

  -- The € standing and games played. A player who has never been rated has no
  -- row; the client's VALUE_START default covers that, so leave them null and
  -- let the empty state speak instead of inventing a €10M they never earned.
  select value, games into v_value, v_games
  from public.player_ratings
  where user_id = p_user_id;

  -- Byte-identical to rh_match_history's select, with p_user_id where it reads
  -- v_uid — so historyFrom() on the client parses both without a second shape.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'match_id', m.match_id,
        'created_at', m.created_at,
        'delta', m.delta,
        'value_after', m.value_after,
        'result', m.result,
        'opponent_id', m.opponent_id,
        'opponent_name', m.opponent_name,
        'opponent_avatar', m.opponent_avatar
      )
      order by m.created_at desc, m.id desc
    ),
    '[]'::jsonb
  )
  into v_matches
  from (
    select
      them.id,
      them.match_id,
      them.created_at,
      them.delta,
      them.value_after,
      them.result,
      opp.user_id     as opponent_id,
      p.display_name  as opponent_name,
      p.avatar_path   as opponent_avatar
    from public.rating_events them
    left join public.rating_events opp
      on opp.match_id = them.match_id
     and opp.user_id <> them.user_id
    left join public.profiles p
      on p.user_id = opp.user_id
    where them.user_id = p_user_id
    order by them.created_at desc, them.id desc
    limit v_limit
  ) m;

  -- The whole career, not just the fetched window — and the same legacy
  -- fallback rh_match_history spells out: a null result reads from the sign of
  -- the delta, so pre-0041 draws count as win/loss because the data cannot say.
  select jsonb_build_object(
    'wins',   count(*) filter (
                where coalesce(result, case when delta > 0 then 'win' else 'loss' end) = 'win'),
    'losses', count(*) filter (
                where coalesce(result, case when delta > 0 then 'win' else 'loss' end) = 'loss'),
    'draws',  count(*) filter (where result = 'draw')
  )
  into v_record
  from public.rating_events
  where user_id = p_user_id;

  return jsonb_build_object(
    'value', v_value,
    'games', coalesce(v_games, 0),
    'matches', v_matches,
    'record', v_record
  );
end;
$$;

revoke execute on function public.rh_friend_career(uuid, int) from public, anon;
grant execute on function public.rh_friend_career(uuid, int) to authenticated;
