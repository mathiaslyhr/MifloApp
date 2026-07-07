-- Miflo: remote app configuration (key/value), read by every client.
--
-- Design notes (mirrors 0001_rooms.sql):
--  * Public read-only config. RLS is on with a permissive SELECT policy so any
--    (anonymous) client can read it; there is NO insert/update policy, so values
--    are managed only from the Supabase dashboard / SQL — clients can't forge them.
--  * First use: `min_supported_version` powers the hard "update required" gate
--    (see src/core/version). Bump this value to force old app builds to update.

create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Anyone (incl. anonymous auth users) may read config; nobody may write via the API.
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config
  for select
  using (true);

-- Seed the minimum supported app version. Raise this to block older builds.
insert into public.app_config (key, value)
values ('min_supported_version', '1.0.0')
on conflict (key) do nothing;
