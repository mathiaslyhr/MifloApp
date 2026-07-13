-- Move a profile to a new phone.
--
-- Miflo has no login: identity IS the anonymous Supabase session (auth.uid()),
-- persisted only in the phone's local AsyncStorage. A new phone therefore mints
-- a brand-new uid and the old profile (friends, results, favorites, streaks) is
-- orphaned. This table backs a device-linking transfer, WhatsApp/Signal style:
--
--   1. new phone types the OWNER's public friend code  -> a pending row
--      (target_uid = the profile being moved, new_uid = the new phone's uid)
--   2. the OLD phone (the only device that can prove it owns the uid, because it
--      holds the session) sees the request and, on Approve, stores an encrypted
--      payload = { the old session tokens + a snapshot of local-only state }
--   3. the new phone redeems the payload, calls setSession(...) and BECOMES the
--      same uid — every server row stays valid (no re-keying), and the local
--      streaks/history/settings ride along in the payload.
--
-- The security gate is the Approve tap on the old phone: the friend code is
-- public, so it can never be enough on its own. The match_code is shown on both
-- screens so the owner can confirm it's really their new phone.
--
-- All writes go through the transfer-* Edge Functions (service role); the anon
-- role only SELECTs its own rows (RLS below) to poll status / see the request.
-- The payload column is NEVER granted to clients (column privilege) and is
-- encrypted at rest anyway — defense in depth. Rows are short-lived and
-- single-use; see the Edge Functions.

create table if not exists public.device_transfers (
  id          uuid primary key default gen_random_uuid(),
  -- The profile being moved (friend-code owner / old phone).
  target_uid  uuid not null references auth.users (id) on delete cascade,
  -- The requesting new device's fresh anonymous uid.
  new_uid     uuid not null references auth.users (id) on delete cascade,
  -- 4-char confirmation shown on BOTH screens so the owner verifies the phone.
  match_code  text not null,
  status      text not null default 'pending'
    check (status in ('pending', 'approved', 'redeemed', 'denied')),
  -- Encrypted { access_token, refresh_token, local:{…} }; null until approved.
  payload     text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  redeemed_at timestamptz,
  check (target_uid <> new_uid)
);

-- The old phone polls "any pending request FOR me?"; the new phone polls "is my
-- request approved yet?". Both are indexed by their uid column.
create index if not exists device_transfers_target_idx
  on public.device_transfers (target_uid, status);
create index if not exists device_transfers_new_idx
  on public.device_transfers (new_uid, status);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.device_transfers enable row level security;

-- Both parties may read a row they're part of (status + match_code drive the
-- two waiting UIs). Writes are service-role only (Edge Functions) — no insert/
-- update/delete policy exists, so clients can never forge or tamper with a row.
drop policy if exists device_transfers_select on public.device_transfers;
create policy device_transfers_select on public.device_transfers
  for select using (auth.uid() in (target_uid, new_uid));

-- Column-level: the encrypted payload must never reach a client, not even the
-- new phone via PostgREST (it collects the payload through transfer-redeem, over
-- the service role). Grant SELECT on every column EXCEPT payload.
revoke select on public.device_transfers from authenticated;
grant select (
  id, target_uid, new_uid, match_code, status, created_at, expires_at, redeemed_at
) on public.device_transfers to authenticated;

-- ── Deny ───────────────────────────────────────────────────────────────────────

-- Declining a request is a pure status flip keyed on auth.uid() — no payload, no
-- encryption — so it's a SECURITY DEFINER RPC (like decline_friend_request)
-- rather than an Edge Function. The owner declines from the approval modal; the
-- new phone, polling, sees 'denied' and stops waiting. Approve/redeem stay Edge
-- Functions because they carry the encrypted payload.
create or replace function public.deny_device_transfer(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.device_transfers
     set status = 'denied'
   where id = p_id and target_uid = auth.uid() and status = 'pending';
$$;

grant execute on function public.deny_device_transfer(uuid) to authenticated;
