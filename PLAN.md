# Miflo app — frontend rebuild plan

Rebuild the Miflo app frontend in the website's light **rainbow / glass** design. The app's v1.0
was dark mode; the website (`/Users/mathiaslyhr/Developer/Miflo`, the design reference) is a light
gradient/glass "rainbow" design the app now adopts: same rainbow gradient canvas, same pill
buttons, same springy press feel, same sizing.

This repo (`MifloApp`) keeps its **engine** and rebuilds the **presentation layer** from scratch.

## What's kept vs rebuilt

- **Kept — the engine (do not rebuild):** `src/core/{config,feedback,identity,rooms,stats,supabase}`,
  `src/data/football/*`, and every game's non-UI logic under `src/games/*/`
  (`room.ts`, `store.ts`, `questions.ts`, `scoring.ts`, `matching.ts`, `mockData.ts`, …).
- **Rebuilt from scratch — the presentation layer:** `src/theme/`, `src/core/ui/`,
  `src/core/navigation/`, and every screen.

## How we work

**One screen at a time — perfect before moving on.** A screen is "done" only when it passes its
Definition of Done: built with the design system, wired to real engine data, runs on device,
visually reviewed side-by-side against the website, and signed off by the user. No batch-building.

## Canvas vs white (design decision)

- **Rainbow canvas** = the chrome: Home, Games, Menu, Join, Lobby, Podium.
- **White / off-white** = where the game is played: all Create-game & Question screens, and the
  Menu detail screens (heavy functional color — success/error/timer/accent — needs a calm ground).

## Design decisions (confirmed)

- Gradient: **rainbow** (website `HOME_BASE`), a vertical wash + soft radial blooms. **Static**
  (best FPS/battery, free reduced-motion support).
- Press feel: **shared across every control** — scale→0.96 / opacity→0.9, 200ms,
  `Easing.bezier(0.34,1.25,0.64,1)`; Reduce Motion → opacity-only.
- **Primary button = solid black** (marketing `SolidButton`), establishing a 3-variant pill system
  (primary solid-black / outline / secondary frosted-white).
- **Home = clean hub** (matches the in-phone app mock): wordmark + avatar, Create a room, Join a
  room, QR "scan to get the app", island nav. Games live on the Games tab, not Home.

## Reference (website repo = source of truth)

- `Miflo/design.md` → copied to `MifloApp/docs/design.md` (tokens, type, gradient, interaction).
- `Miflo/src/components/glass/MeshGradient.tsx` — `HOME_BASE` wash + rainbow blob values.
- `Miflo/src/components/glass/controls.tsx` — button variants + press easing.
- `Miflo/src/components/showcase/screens/*` + `parts.tsx` — the in-phone app mock (the RN target).

## Screen build queue

See **`docs/SCREENS.md`** for live status. Order: Home → nav shell → Games → Menu → Join → Lobby →
Quiz (Create→Question→Podium) → Odd One Out → Missing XI → Menu detail screens.

Notes for the reader (Claude/human): tokens live in `src/theme/`; shared primitives in
`src/core/ui/`. Never hardcode hex in a screen. Build a new primitive only when the screen that
needs it is reached.
