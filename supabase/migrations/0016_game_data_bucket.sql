-- Miflo: public storage bucket for over-the-air game content packs (football
-- players/clubs/managers, treble squads, famous lineups, the frozen Scout
-- schedule, and the Red Card question pool + strings).
--
-- Design notes (mirrors 0013_app_config.sql):
--  * Written ONLY by scripts/publish-football-dataset.mjs with the service-role
--    key (which bypasses RLS); no write policies exist, so the anon key can
--    never write.
--  * Clients read over the PUBLIC object URL (`/object/public/game-data/...`),
--    which a public bucket serves without any RLS policy — so no policy on
--    storage.objects is needed (and creating one from a migration fails on
--    hosted Supabase, where postgres does not own that table). Objects:
--      manifest.json                  — tiny pointer {version, path, checksum},
--                                       short cache so publishes go live fast
--      datasets/dataset-<hash>.json   — immutable content-addressed pack,
--                                       cached long
--    (see src/data/football/remote/datasetSync.ts)

insert into storage.buckets (id, name, public)
values ('game-data', 'game-data', true)
on conflict (id) do update set public = true;
