-- 0041: ranked match history — the € curve gets a memory.
--
-- Ranked's only per-match record is rating_events(match_id, user_id, delta):
-- enough to know the € moved, never enough to say who moved it or which way.
-- The Profile tab's career page needs both — an opponent to name and a result
-- to read — so this keeps the two facts the settle path already computes and
-- currently throws away, and adds one RPC to read them back.
--
-- Both players in a match share a match_id (matchIdFrom hashes the room id +
-- the sorted user ids), so the opponent was always recoverable by self-joining
-- rating_events. What blocked it is RLS: rating_events is select-own, so you
-- can't read the other player's row. Hence the SECURITY DEFINER read below —
-- same shape as worldwide_leaderboard (0030).
--
-- Privacy: rh_match_history returns a ranked opponent's display name and avatar
-- to someone who may not be their friend, stepping around the friend-scoped
-- profiles RLS. That is not a new exposure — both are already on screen during
-- the match itself, denormalized onto the players row. Nothing else from
-- profiles is returned: no friend code, no favorites, no presence.

-- ── The two facts ────────────────────────────────────────────────────────────
-- Both nullable: every existing row predates them, and a NOT NULL default would
-- have to invent data.

alter table public.rating_events
  add column if not exists result      text,
  add column if not exists value_after bigint;

alter table public.rating_events
  drop constraint if exists rating_events_result_check;
alter table public.rating_events
  add constraint rating_events_result_check
  check (result is null or result in ('win', 'loss', 'draw'));

-- The self-join below pairs the two rows of a match by match_id. The existing
-- index is (user_id, created_at desc), which can't serve that lookup.
create index if not exists rating_events_match_idx
  on public.rating_events (match_id);

-- ── Backfill value_after ─────────────────────────────────────────────────────
-- Deltas are stored post-clamp (0037), so walking back from the current
-- snapshot is exact rather than an estimate: the € standing after event i is
-- the player's value today minus every delta that landed after it.

with sums as (
  select
    e.id,
    r.value - coalesce(
      sum(e.delta) over (
        partition by e.user_id
        order by e.created_at desc, e.id desc
        rows between unbounded preceding and 1 preceding
      ), 0) as va
  from public.rating_events e
  join public.player_ratings r on r.user_id = e.user_id
)
update public.rating_events e
set value_after = s.va
from sums s
where s.id = e.id
  and e.value_after is null;

-- `result` is deliberately NOT backfilled. In the existing data a draw is
-- mathematically indistinguishable from a loss: rh_settle_value always writes
-- the two players opposite-signed deltas, whether p_draw was true or not. Old
-- rows therefore stay null and are read as win/loss by the sign of the delta
-- (see rh_match_history below); only matches played from this migration on can
-- say "draw" truthfully.

-- ── rh_settle_value: keep the result and the € it left behind ────────────────
-- Byte-identical to 0037 except the closing insert. This is the single
-- chokepoint every result passes through — rh_finish (normal end) and
-- rh_apply_loss (forfeit / kick) both call it — so widening it here covers
-- every way a ranked match can end.

create or replace function public.rh_settle_value(
  p_match_id text, p_winner uuid, p_loser uuid, p_draw boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  val_w bigint; val_l bigint; e_w numeric; score_w numeric; d bigint;
  new_w bigint; new_l bigint;
begin
  select coalesce((select value from public.player_ratings where user_id = p_winner), 10000000) into val_w;
  select coalesce((select value from public.player_ratings where user_id = p_loser),  10000000) into val_l;
  e_w := 1.0 / (1.0 + power(10.0, (val_l - val_w) / 40000000.0));
  score_w := case when p_draw then 0.5 else 1.0 end;
  d := round(5000000 * (score_w - e_w))::bigint;
  new_w := public.rh_clamp_value(val_w + d);
  new_l := public.rh_clamp_value(val_l - d);

  insert into public.player_ratings (user_id, value, games) values (p_winner, new_w, 1)
    on conflict (user_id) do update
    set value = new_w, games = public.player_ratings.games + 1, updated_at = now();
  insert into public.player_ratings (user_id, value, games) values (p_loser, new_l, 1)
    on conflict (user_id) do update
    set value = new_l, games = public.player_ratings.games + 1, updated_at = now();
  -- Record the actual (post-clamp) € change so the trend is truthful, plus the
  -- result and the € it left behind — the two facts 0041 exists to keep.
  insert into public.rating_events (match_id, user_id, delta, result, value_after) values
    (p_match_id, p_winner, new_w - val_w, case when p_draw then 'draw' else 'win'  end, new_w),
    (p_match_id, p_loser,  new_l - val_l, case when p_draw then 'draw' else 'loss' end, new_l);
end; $$;

revoke execute on function public.rh_settle_value(text, uuid, uuid, boolean) from public, anon, authenticated;

-- ── rh_match_history: the career page's one read ─────────────────────────────
-- Returns { matches: [ {match_id, created_at, delta, value_after, result,
--                       opponent_id, opponent_name, opponent_avatar} … ],
--           record:  {wins, losses, draws} }
--
-- matches is newest-first, capped at p_limit (default 200, clamped 1..500) —
-- it feeds both the value chart and the recent-matches list from one round
-- trip. record counts the caller's ENTIRE history, not just that window, so a
-- long career still shows a true record.
--
-- Every join is a LEFT join on purpose: a deleted opponent (auth.users cascade)
-- should cost the match its name, not its place in the history.

create or replace function public.rh_match_history(p_limit int default 200)
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

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
      me.id,
      me.match_id,
      me.created_at,
      me.delta,
      me.value_after,
      me.result,
      opp.user_id     as opponent_id,
      p.display_name  as opponent_name,
      p.avatar_path   as opponent_avatar
    from public.rating_events me
    left join public.rating_events opp
      on opp.match_id = me.match_id
     and opp.user_id <> me.user_id
    left join public.profiles p
      on p.user_id = opp.user_id
    where me.user_id = v_uid
    order by me.created_at desc, me.id desc
    limit v_limit
  ) m;

  -- The legacy fallback, spelled the same way the client spells it: a null
  -- result reads from the sign of the delta. A clamped no-op (delta = 0, i.e.
  -- a win already at the €250M cap) lands in 'losses' here; it can only ever
  -- affect pre-0041 rows, since every row written from now on carries a result.
  select jsonb_build_object(
    'wins',   count(*) filter (
                where coalesce(result, case when delta > 0 then 'win' else 'loss' end) = 'win'),
    'losses', count(*) filter (
                where coalesce(result, case when delta > 0 then 'win' else 'loss' end) = 'loss'),
    'draws',  count(*) filter (where result = 'draw')
  )
  into v_record
  from public.rating_events
  where user_id = v_uid;

  return jsonb_build_object('matches', v_matches, 'record', v_record);
end;
$$;

revoke execute on function public.rh_match_history(int) from public, anon;
grant execute on function public.rh_match_history(int) to authenticated;
