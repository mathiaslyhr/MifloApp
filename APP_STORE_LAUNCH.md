# Miflo — App Store launch checklist

Plan: **ship now** (iPhone only, iOS). Miflo ships with **three playable games**,
all on the shared room / lobby / realtime layer plus a local single-player mode:

- **Scout** — solo daily footballer guess (local, no backend).
- **Hattrick** — 1v1 footballer tic-tac-toe (multiplayer room).
- **Red Card** — party social-deduction / imposter (multiplayer room).

Two more (**Tenball**, **Heatmap**) show as dimmed "coming soon" tiles in the
Games hub (`available: false` in `src/screens/gamesCatalog.ts`) — intentional,
not dead links. The older `quiz` / `odd-one-out` / `missing-xi` engines still
exist under `src/games/` but are **not surfaced** anywhere in the UI.

Bundle id: `com.mathiaslyhr.miflo` · marketing version 1.0 · build 3 · iPhone
only (`TARGETED_DEVICE_FAMILY = 1`).

Work through these in order. Check items off as you go.

## Done in-repo (already committed to this branch)

- [x] **App icon** — flattened to opaque RGB (Apple rejects alpha). Regenerate any
      time with `npm run icons`; `scripts/generate-app-icon.mjs` now strips the
      alpha channel on the iOS 1024 master. Verify: `sips -g hasAlpha
      ios/Miflo/Images.xcassets/AppIcon.appiconset/icon-1024.png` → `no`.
- [x] **Launch screen** — replaced the "Powered by React Native" template with a
      branded screen (brand wash `#fdf2f7` + centered logo). Logo asset is
      `LaunchLogo.imageset`, also emitted by `npm run icons`.
- [x] **Crash reporting (Sentry)** — `@sentry/react-native` wired in
      `src/core/observability/sentry.ts`, initialized from `index.js`, app
      wrapped with `Sentry.wrap`. Release-only, no PII. **Needs a DSN + a source-
      map/dSYM build phase — see item 5 below.**
- [x] **Privacy manifest** — `ios/Miflo/PrivacyInfo.xcprivacy` now declares Crash
      Data, Other Diagnostic Data, and Other User Content (nicknames + feedback),
      all unlinked to identity and not used for tracking. `NSPrivacyTracking`
      stays false.
- [x] **iPhone only** — device family already locked to iPhone; no iPad
      screenshots required.

## Must do before submission

- [ ] **1. Apple Developer account** — membership active ($99/yr); create the app
      record in App Store Connect using bundle id `com.mathiaslyhr.miflo`.

- [ ] **2. Privacy policy** — already written and hosted at
      `https://miflo.dk/privacy` (matches `PRIVACY_POLICY_URL` in
      `src/core/config.ts`). Link it in App Store Connect. FAQ
      (`https://miflo.dk/faq`) and feedback (`https://miflo.dk/feedback`) pages
      are also live and linked from the Menu.

- [ ] **3. Sentry finish** — create the Sentry project, then:
      - Paste the DSN into `SENTRY_DSN` in `src/core/config.ts` (safe to commit).
      - Add the source-map / dSYM upload build phase so crashes symbolicate. The
        one-shot way: `npx @sentry/wizard@latest -i reactNative` (adds the Xcode
        build phase + `ios/sentry.properties`; needs your Sentry auth token).
        Without it Sentry still captures errors, just unsymbolicated.
      - Sanity check in a Release build: `Sentry.nativeCrash()` should appear in
        the Sentry dashboard.

- [ ] **4. Store metadata** — name, subtitle, description, keywords, category
      (Games → Trivia), age rating. *Required to submit.* After the listing
      exists, set the real `APP_STORE_URL` in `src/core/config.ts` (it drives the
      Home download QR + update gate; today it's a placeholder). Ask Claude to
      draft the copy when ready.

- [ ] **5. App Privacy label** (App Store Connect questionnaire) — match the
      privacy manifest:
      - **Crash Data / Diagnostics** (via Sentry) → collected, **not** linked to
        identity, **not** used for tracking, purpose: App Functionality.
      - **User Content** — player nicknames (`rename_player`) and free-text
        feedback (`submit_feedback`) → collected, not linked to identity, not for
        tracking, purpose: App Functionality.
      - No tracking, no ad identifiers, no third-party analytics.

- [ ] **6. Screenshots** — iPhone 6.9" set (+ 6.5" optional). Capture the Games
      hub, a screen from each of Scout / Hattrick / Red Card, and a lobby or
      results view. (Project rule: build & run the Release app on the connected
      iPhone, not the Simulator.)

- [ ] **7. Backend prod check** (project ref `hppsryxrdzxzusruftrj`) — the
      committed anon key is only safe if RLS is live. Confirm on the prod project:
      - **All migrations 0001–0015 applied.** Historically only `0006` was
        tracked; there is no record for `0007`–`0015` (feedback, app_config /
        update gate, board games / Hattrick, ties, Red Card). Diff with the
        Supabase CLI or query `supabase_migrations.schema_migrations`. Hattrick
        needs 0012+0014, Red Card needs 0015, the update gate needs 0013. (Scout
        is fully local — no backend.)
      - **Anonymous sign-ins enabled** in Auth settings (every table references
        `auth.users`; no session = no rooms).
      - **RLS spot-check** — direct client reads/writes to `rooms`, `players`,
        `game_results`, `red_card_secrets`/`red_card_votes` are rejected.
      - **`feedback-email` edge function** deployed with `RESEND_API_KEY` set
        (non-blocking — feedback still persists to the DB if email fails).

- [ ] **8. Build & submit** — confirm the build number is higher than any prior
      TestFlight upload, Archive in Xcode → upload → TestFlight internal test →
      submit for review.

## Known non-blockers

- **`__tests__/App.test.tsx` fails in jest** — pre-existing, test-environment
  only. `@react-native-masked-view` (used in `TopStatusFade`) isn't in
  `jest.config.js` `transformIgnorePatterns`, so the full-app render test can't
  transform it. The other 189 tests pass. Not shipped; fix when convenient by
  adding `@react-native-masked-view` to the transform allow-list.
- **`ios/build-sim/`** — stale simulator build products; `pod install` warns
  about reading its Info.plist. Harmless; safe to delete.

## Deferred (post-launch)

- [ ] **CI/CD** — GitHub Actions for automated builds/tests.
- [ ] **Account/data deletion flow** — no user accounts today (anonymous auth),
      so Apple's in-app-deletion rule likely doesn't apply, but a "delete my
      data" path is worth adding if a reviewer asks (feedback + nicknames persist
      server-side).
- [ ] **Sentry performance tracing** — currently `tracesSampleRate: 0` (crashes
      only). Turn up later if you want performance data.

---
_Store copy and any additional privacy wording can be drafted with Claude when
you're ready — just ask._
