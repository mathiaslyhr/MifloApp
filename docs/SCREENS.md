# Screens tracker

Live status of the frontend rebuild (see `PLAN.md`). One screen at a time — each must pass its
Definition of Done and be signed off before the next starts.

**Status key:** `todo` · `in progress` · `done`

| # | Screen | Background | Status | Notes |
|---|--------|-----------|--------|-------|
| 1 | **Home** | canvas (rainbow) | 🟡 in progress | Clean hub: wordmark + avatar, Create a room (primary solid-black), Join a room (secondary frosted), QR of `APP_STORE_URL`, island nav (Home active). Ships with Phase A foundation. |
| 2 | Navigation shell | — | ⬜ todo | `core/navigation/` native-stack root + IslandTabBar bottom tabs (Home · Games · Menu). Wire `App.tsx`. Wires Home's Create/Join + the Games/Menu tabs. |
| 3 | Games | canvas | ⬜ todo | Full games grid/list. New primitive: `GameTile` (glass card). |
| 4 | Menu | canvas | ⬜ todo | Hub list on rainbow, list card as glass. New: menu row. |
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
