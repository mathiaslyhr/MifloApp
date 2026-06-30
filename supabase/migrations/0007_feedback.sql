-- Miflo: in-app + website feedback (questions / bugs / ideas).
--
-- Design notes (mirrors 0001_rooms.sql):
--  * No login — submitters are anonymous Supabase users (auth.uid()).
--  * RLS is on. There is NO insert policy: every write goes through the
--    SECURITY DEFINER `submit_feedback` RPC, so the client can't forge rows.
--  * The app/website never read this table; you read submissions in the
--    Supabase dashboard. Hence no select policy either.

-- ── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category    text not null default 'general'
                check (category in ('general', 'bug', 'idea')),
  message     text not null,
  app_version text,
  -- 'app' or 'web' so you can tell where a suggestion came from.
  source      text not null default 'app',
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- ── RLS (locked down; writes go through the RPC below) ───────────────────────

alter table public.feedback enable row level security;

-- ── Write RPC (SECURITY DEFINER; bypasses RLS in a controlled way) ───────────

create or replace function public.submit_feedback(
  p_category    text,
  p_message     text,
  p_app_version text default null,
  p_source      text default 'app'
)
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

  if p_message is null or length(btrim(p_message)) = 0 then
    raise exception 'Message is required';
  end if;

  insert into public.feedback (user_id, category, message, app_version, source)
  values (
    v_uid,
    coalesce(nullif(p_category, ''), 'general'),
    btrim(p_message),
    p_app_version,
    coalesce(nullif(p_source, ''), 'app')
  );
end;
$$;

grant execute on function public.submit_feedback(text, text, text, text) to authenticated;
