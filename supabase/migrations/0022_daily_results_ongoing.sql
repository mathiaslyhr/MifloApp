-- Patch for databases that ran an early cut of 0020 before 'ongoing' landed:
-- `create table if not exists` never updates an existing table's check
-- constraints, so prod kept status in ('won','revealed') while the repo's
-- 0020 (and the publish_daily_results RPC, which IS create-or-replace'd)
-- already allow 'ongoing'. Without this, the first live in-progress row
-- violates the table check and jams the client outbox.
--
-- Re-runnable: drop-if-exists then add.

alter table public.daily_results
  drop constraint if exists daily_results_status_check;

alter table public.daily_results
  add constraint daily_results_status_check
  check (status in ('won', 'revealed', 'ongoing'));
