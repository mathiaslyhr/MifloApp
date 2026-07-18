# Miflo

React Native (bare, iPhone-only) football party-games app. Football data lives in `src/data/football/`, games in `src/games/`, Supabase backend under `supabase/`.

## Editing game data (players, clubs, managers, questions)

Game content ships over the air: installed apps pull it from Supabase Storage, no App Store build needed. **The last step of ANY data edit is always:**

```
git commit …          # publish refuses uncommitted data
npm run data:publish  # validates + uploads; live for users in ~1 minute
```

Never finish a player/club/manager/question change without running (or, if the session cannot run it, explicitly reminding the user to run) `npm run data:publish`.

## Code fixes need an app build (not OTA)

Only the football **dataset** (players/clubs/managers/questions) ships over the
air via `data:publish`. Changes to **logic** (`repository.ts`, game engines,
UI) reach users only through an App Store build — `data:publish` will report
"nothing to publish" for them.

The `leagueTitle` matcher fix (Franck Ribéry showing as a Serie A winner) was
merged in `badb03e` and shipped in **1.0 (21)**, 2026-07-16. Nothing pending.

Hard rules for data edits:

- **Never rename or delete an existing footballer `id`** (`'Surname, First'`). Ids are permanent tags used by the Scout schedule, online rooms, and saved progress. Wrong display name? Fix the `name` field, keep the `id`.
- **Art can ship OTA now (since 1.0 (22), live-verified 2026-07-18).** Flags, crests, and portraits ride the pack via its `remoteArt` section: bundled art stays the instant/offline path, anything a binary lacks streams from Supabase. To add art for a new country/club, register a source so `data:publish` can fetch + upload it — a `COUNTRY_ISO` (flag) or `CLUB_SLUG` (crest) entry in `scripts/lib/art-sources.js` — then publish. **The source must actually resolve** (crest slug at the footylogos R2 bucket, flag ISO at flagcdn); publish hard-fails on a 404, and there is NO "blank crest" state — a club with no resolvable art fails both the publish gate and the on-device pack validator (which rejects the WHOLE pack). Caveat: OTA-only art only renders on installs running the enabling build (22+); older installs reject the pack, so only publish OTA-only art once the audience is on 22+. Optionally fold OTA art into the bundle later (`npm run assets:flags` / `assets:logos` before a build). Full recipe + gotchas: `memory/ota-art-remote.md`.
- Keep `footballers.ts` sorted by id: `node scripts/sort-footballers.mjs` after bulk additions.
