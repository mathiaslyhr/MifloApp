-- 0027 — daily_results carries the right count too
--
-- The Log tab (and friends' mirror of it) now shows a right/wrong pair per day,
-- not a single tries number. The wire already had two numeric slots — `score`
-- (kept: the wrong count) and `total` (a leftover from the old
-- found-out-of-total design, locked to 10/11/null and always sent null by
-- clients). Repurpose `total` as the right count (0..11: found slots, or
-- 1-on-a-win/0 for the guess-one-player games).
--
-- Backward compatible: null is still allowed, so old queued rows and older app
-- builds (which send total = null) keep inserting; the friend UI reads a null
-- total back as 0 right until the row is republished.

alter table public.daily_results
  drop constraint if exists daily_results_total_check;

alter table public.daily_results
  add constraint daily_results_total_check
  check (total is null or total between 0 and 11);

comment on column public.daily_results.score is
  'Wrong count: misses (Top Bins/Team sheet) or non-winning guesses (Scout/Journeyman).';
comment on column public.daily_results.total is
  'Right count 0..11: found slots, or 1-on-a-win/0 for the guess-one-player games. Null on pre-0027 rows.';

-- Same body as 0020, with the `total` validation widened from `in (10, 11)` to
-- `between 0 and 11` (null still accepted).
create or replace function public.publish_daily_results(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'No profile';
  end if;
  if p_results is null
     or jsonb_typeof(p_results) <> 'array'
     or jsonb_array_length(p_results) > 100 then
    raise exception 'Malformed results';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_results) r
    where coalesce(r->>'date_key', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or (r->>'date_key')::date > current_date + 1
       or coalesce(r->>'game', '') not in ('scout','tenball','journeyman','teamsheet')
       or coalesce(r->>'status', '') not in ('won','revealed','ongoing')
       or jsonb_typeof(r->'score') <> 'number'
       or (r->>'score')::numeric not between 0 and 500
       or (jsonb_typeof(r->'total') <> 'null'
           and (jsonb_typeof(r->'total') <> 'number'
                or (r->>'total')::numeric not between 0 and 11))
       or jsonb_typeof(r->'streak') <> 'number'
       or (r->>'streak')::numeric not between 0 and 10000
  ) then
    raise exception 'Malformed results';
  end if;

  insert into public.daily_results (user_id, date_key, game, status, score, total, streak)
  select
    v_uid,
    r->>'date_key',
    r->>'game',
    r->>'status',
    (r->>'score')::int,
    (r->>'total')::int,
    (r->>'streak')::int
  from jsonb_array_elements(p_results) r
  on conflict (user_id, date_key, game) do update
    set status = excluded.status,
        score = excluded.score,
        total = excluded.total,
        streak = excluded.streak,
        published_at = now()
    -- A finished day is final: a stale 'ongoing' row can never downgrade it.
    where daily_results.status = 'ongoing' or excluded.status <> 'ongoing';
end;
$$;

grant execute on function public.publish_daily_results(jsonb) to authenticated;
