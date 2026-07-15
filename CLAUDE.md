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

**Pending — verify it's in the next build I ship:** the `leagueTitle` matcher
fix (`src/data/football/repository.ts`, branch
`claude/frank-ribery-serie-a-bug-xijfg6`) that stopped Franck Ribéry showing as
a Serie A winner on the hattrick tie screen. It's a code change, so it is NOT
live for installed apps yet — confirm the branch is merged and included the
next time an app build goes out.

Hard rules for data edits:

- **Never rename or delete an existing footballer `id`** (`'Surname, First'`). Ids are permanent tags used by the Scout schedule, online rooms, and saved progress. Wrong display name? Fix the `name` field, keep the `id`.
- **Images never ship OTA.** Flags, crests, and portraits are bundled at build time. New players must only use countries/clubs whose art already exists in `src/games/hattrick/assets/flags.generated.ts` / `logos.generated.ts`; `data:publish` hard-fails otherwise. Genuinely new art = asset scripts (`npm run assets:flags` / `assets:logos`) + a real App Store release, treated as a separate task.
- Keep `footballers.ts` sorted by id: `node scripts/sort-footballers.mjs` after bulk additions.
