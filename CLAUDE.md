# Miflo

React Native (bare, iPhone-only) football party-games app. Football data lives in `src/data/football/`, games in `src/games/`, Supabase backend under `supabase/`.

## Editing game data (players, clubs, managers, questions)

Game content ships over the air: installed apps pull it from Supabase Storage, no App Store build needed. **The last step of ANY data edit is always:**

```
git commit …          # publish refuses uncommitted data
npm run data:publish  # validates + uploads; live for users in ~1 minute
```

Never finish a player/club/manager/question change without running (or, if the session cannot run it, explicitly reminding the user to run) `npm run data:publish`.

Hard rules for data edits:

- **Never rename or delete an existing footballer `id`** (`'Surname, First'`). Ids are permanent tags used by the Scout schedule, online rooms, and saved progress. Wrong display name? Fix the `name` field, keep the `id`.
- **Images never ship OTA.** Flags, crests, and portraits are bundled at build time. New players must only use countries/clubs whose art already exists in `src/games/hattrick/assets/flags.generated.ts` / `logos.generated.ts`; `data:publish` hard-fails otherwise. Genuinely new art = asset scripts (`npm run assets:flags` / `assets:logos`) + a real App Store release, treated as a separate task.
- Keep `footballers.ts` sorted by id: `node scripts/sort-footballers.mjs` after bulk additions.
