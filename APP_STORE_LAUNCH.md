# Miflo — App Store launch checklist

Plan: **ship now**. Miflo ships with **three games** — Football Quiz, Odd One
Out, and Missing XI — all multiplayer over the same room/lobby/realtime layer.
The app code is production-ready; what's left below is mostly App Store Connect /
account work, plus one database migration. Bundle id: `com.mathiaslyhr.miflo` ·
version 1.0 / build 1.

Work through these in order. Check items off as you go.

## Must do before submission

- [ ] **0. Apply the multi-game DB migration** — run
      `supabase/migrations/0006_multi_game_rooms.sql` in the Supabase dashboard
      (the DB isn't linked locally). It adds `rooms.game_type` and a
      `p_game_type` arg to `create_room`. **Backward compatible** (defaults to
      `'quiz'`), but the two new games can't create rooms until it's applied.

- [ ] **1. Apple Developer account** — membership active ($99/yr) and create the
      app record in App Store Connect using bundle id `com.mathiaslyhr.miflo`.
- [ ] **2. Privacy policy** — write it and host it at a public URL, then link it
      in App Store Connect. *Required* — submission is blocked without it.
      (The app already ships a `PrivacyInfo.xcprivacy` manifest declaring no
      tracking / no data collection, so the policy can be short and truthful.)
- [ ] **3. Store metadata** — name, subtitle, description, keywords, category
      (Games → Trivia), and age rating. After the listing exists, update the
      `APP_STORE_URL` placeholder in `src/core/config.ts` to the real link.
- [ ] **4. Screenshots** — capture 6.7" and 6.5" iPhone sets from the simulator.
      Show the multi-game Home hub plus a Question screen from each game (Quiz
      answer options, Odd One Out four cards, Missing XI pitch + name input) and
      a Podium. Add an iPad set only if you support iPad.
- [ ] **5. Crash reporting** — integrate Sentry (recommended) so production
      crashes are visible. None is wired up today.
- [ ] **6. Supabase prod check** — confirm Row Level Security policies are
      correct and the project is on a plan that can take real traffic.
      Multiplayer depends on it; the app falls back to solo if unconfigured.
- [ ] **7. Build & submit** — bump the build number, Archive in Xcode → upload →
      TestFlight internal test → submit for review.

## Deferred (post-launch)

- [ ] **CI/CD** — GitHub Actions workflow for automated builds/tests.
- [ ] **More Missing XI lineups** — ships with 15 iconic XIs; expand the set in
      `src/data/football/famousLineups.ts` over time (same curation process as
      `footballers.ts`).

---
_Drafting the privacy policy and store copy can be done with Claude when you're
ready to start — just ask._
