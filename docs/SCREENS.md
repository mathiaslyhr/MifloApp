# Screens tracker

Live status of the frontend rebuild (see `PLAN.md`). One screen at a time — each must pass its
Definition of Done and be signed off before the next starts.

**Status key:** `todo` · `in progress` · `done`

**Copy convention:** user-facing copy calls the concept a **"party"** (Create a party,
Party, PARTY CODE); code and DB keep the internal name **"room"** (`Room`, `roomService`,
`rooms`/`players` tables, the `Lobby` route). New screens (Join #5, etc.) follow this.

| # | Screen | Background | Status | Notes |
|---|--------|-----------|--------|-------|
| 1 | **Home** | canvas (rainbow) | 🟡 in progress | Clean hub: wordmark + avatar, Create a room (primary solid-black), Join a room (secondary frosted), QR of `APP_STORE_URL`, island nav (Home active). Ships with Phase A foundation. |
| 2 | Navigation shell | — | 🟢 built | `core/navigation/` native-stack root (`RootNavigator`, typed `RootStackParamList`) in `App.tsx`; the `Tabs` route is the Home/Games/Menu shell (`screens/TabsScreen.tsx`, local island toggle, screens kept mounted to avoid mesh re-raster). `Join` + `Lobby` are pushed routes; Home's Create/Join buttons are wired. Menu detail routes still todo. |
| 3 | Games | canvas | 🟢 built | Vertical glass tiles on rainbow canvas. Lineup: **Tic Tac Toe** (football grid — built, see game loop below) · **Tenball** · **Heatmap** (not built). New primitive `GameTile` (`core/ui/`); display catalog `screens/gamesCatalog.ts`. Old games (quiz/missing-xi/odd-one-out) stay in `src/games/` but are off the frontend. Tile tap → `onSelectGame` stub (games start from the lobby's Pick a game, not the tiles). |
| 3b | **Tic-Tac-Toe** (game loop) | canvas | 🟡 in progress | First game + the lobby→game→result→lobby loop. `src/games/tic-tac-toe/` (grid generator via `intersection`; pure engine + tests) and `screens/TicTacToeScreen.tsx`. Turn-based sync via `rooms.game_state` jsonb + RPCs `start_board_game`/`play_move`/`restart_board_game`/`return_to_lobby` (`migrations/0012`). **Individual mode** shipped (host taps Pick a game at ≥2 players → solvable 3×3 → tap a cell, search a footballer who fits both axes → 3-in-a-row / most-cells wins → Play again / Back to lobby). **Teams mode = Phase B** (same engine). |
| 4 | Menu | canvas | 🟡 in progress | Hub built: centered "Menu" wordmark over grouped iOS-style glass cards — **Account** (Profile, subtitle = saved nickname) · **App** (How to play, Settings) · **About** (About Miflo, FAQ, Privacy). Nav rows stub via `onSelectItem` (detail screens = #12); FAQ/Privacy open the site (`FAQ_URL`/`PRIVACY_POLICY_URL`); version footer from `APP_VERSION`. New primitives `MenuRow` + `MenuGroup` (`core/ui/`). Awaiting device sign-off. |
| 5 | Join | canvas | 🟢 built | `screens/JoinScreen.tsx`: enter the 4-char party code (`TextField`, uppercase), random football name, `joinRoom` → `replace('Lobby')`. Inline error on bad/closed code. Reached via Home → Join a party. |
| 6 | Lobby | canvas | 🟡 in progress | `screens/LobbyScreen.tsx`: shareable party code + live Kahoot-style name list (`subscribePlayers`/`subscribeRoom`), own tag purple-outlined, host tag shows a small accent **HOST** pill, name tags zoom on press, player count / "waiting for friends" state. Tap your own name to rename (per-round, no saved name); host taps others to kick (auto-ejects). Leaving (back/swipe) calls `leave_room` — guest drops out cleanly, host closes the party. Host "Pick a game" stubbed (games not built). RPCs `rename_player`/`kick_player`/`leave_room` (`migrations/0008`,`0010`); codes mix letters+digits (`0009`). New: `TextField`, `NameSheet`. |
| 7 | Quiz — CreateGame | white | ⬜ todo | New: `SegmentedOptions`. |
| 8 | Quiz — Question | white | ⬜ todo | Timer ring + answer/result states. |
| 9 | Quiz — Podium | canvas | ⬜ todo | Rank/medal states. |
| 10 | Odd One Out — Create/Question/Podium | white / white / canvas | ⬜ todo | Reuse Quiz primitives. |
| 11 | Missing XI — Create/Question/Podium | white / white / canvas | ⬜ todo | New: lineup UI. |
| 12 | Menu detail: Profile, Stats, Settings, FAQ, Feedback | white | ⬜ todo | Reuse feedback engine + secondary button. |
| 13 | **Pass-and-play (1 device)** | canvas | 🟡 built, device-verify pending | Offline mode for Hattrick + Red Card (flight-mode request). Games tab tile → `PlayModeSheet` chooser ("On this phone" / "Online with friends") → roomless `HattrickLocalScreen` (shared `HattrickGameView` + pure engine) or `RedCardLocalScreen` (handoff-gated pass-the-phone flow over `red-card/localEngine.ts`). Zero network in the local paths. |

## Foundation (Phase A — ships with Home)

- `src/theme/` — `colors`, `radii`, `spacing`, `typography`, `index`.
- `src/core/ui/` — `MeshBackground`, `Screen`, `usePressScale`, `Text`, `Button`, `Avatar`,
  `IslandTabBar`, `QrCard`, `index`.

Extend the design system only as each new screen genuinely needs a new primitive.
