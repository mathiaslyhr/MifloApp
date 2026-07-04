# Screens tracker

Live status of the frontend rebuild (see `PLAN.md`). One screen at a time — each must pass its
Definition of Done and be signed off before the next starts.

**Status key:** `todo` · `in progress` · `done`

| # | Screen | Background | Status | Notes |
|---|--------|-----------|--------|-------|
| 1 | **Home** | canvas (rainbow) | 🟡 in progress | Clean hub: wordmark + avatar, Create a room (primary solid-black), Join a room (secondary frosted), QR of `APP_STORE_URL`, island nav (Home active). Ships with Phase A foundation. |
| 2 | Navigation shell | — | 🟡 partial | Tab switch in `App.tsx` now covers all three tabs (Home ⇄ Games ⇄ Menu via `IslandTabBar.onSelect` → `setTab`; screens kept mounted to avoid mesh re-raster). Full `core/navigation/` native-stack root + Home's Create/Join wiring + Menu detail routes still todo. |
| 3 | Games | canvas | 🟢 built | Vertical glass tiles on rainbow canvas. New lineup (not built yet): **Tic Tac Toe** · **Tenball** (rank 1–10, 3 lives) · **Heatmap** (31 hexagons, bigger tic-tac-toe). New primitive `GameTile` (`core/ui/`); display catalog `screens/gamesCatalog.ts`. Old games (quiz/missing-xi/odd-one-out) stay in `src/games/` but are off the frontend. Tile tap → `onSelectGame` stub. |
| 4 | Menu | canvas | 🟡 in progress | Hub built: centered "Menu" wordmark over grouped iOS-style glass cards — **Account** (Profile, subtitle = saved nickname) · **App** (How to play, Settings) · **About** (About Miflo, FAQ, Privacy). Nav rows stub via `onSelectItem` (detail screens = #12); FAQ/Privacy open the site (`FAQ_URL`/`PRIVACY_POLICY_URL`); version footer from `APP_VERSION`. New primitives `MenuRow` + `MenuGroup` (`core/ui/`). Awaiting device sign-off. |
| 5 | Join | canvas | ⬜ todo | Enter room code. New: `TextField`. |
| 6 | Lobby | canvas | ⬜ todo | Players gathering. New: `Avatar` (host ring), `Badge`. |
| 7 | Quiz — CreateGame | white | ⬜ todo | New: `SegmentedOptions`. |
| 8 | Quiz — Question | white | ⬜ todo | Timer ring + answer/result states. |
| 9 | Quiz — Podium | canvas | ⬜ todo | Rank/medal states. |
| 10 | Odd One Out — Create/Question/Podium | white / white / canvas | ⬜ todo | Reuse Quiz primitives. |
| 11 | Missing XI — Create/Question/Podium | white / white / canvas | ⬜ todo | New: lineup UI. |
| 12 | Menu detail: Profile, Stats, Settings, FAQ, Feedback | white | ⬜ todo | Reuse feedback engine + secondary button. |

## Foundation (Phase A — ships with Home)

- `src/theme/` — `colors`, `radii`, `spacing`, `typography`, `index`.
- `src/core/ui/` — `MeshBackground`, `Screen`, `usePressScale`, `Text`, `Button`, `Avatar`,
  `IslandTabBar`, `QrCard`, `index`.

Extend the design system only as each new screen genuinely needs a new primitive.
