# Miflo

Social party games you play with friends in the same room. **Game 1** is a
football trivia quiz — "Kahoot for football, played with your mates at
half-time." Miflo is the platform, not the quiz: the Home screen is a hub and
the multiplayer backbone is game-agnostic.

iOS only for now (iPhone, design width 393pt). Bare React Native + TypeScript
(React Native Community CLI — **not** Expo).

## Stack

- React Native 0.86 (TypeScript) + React Navigation (native-stack)
- Supabase (Postgres + Realtime) — wired in M2/M3
- Zustand for light state, AsyncStorage for device id + nickname
- `react-native-svg` for icons / the countdown ring
- Satoshi typeface (bundled), system fallback

## Project structure

```
src/
  theme/            Design tokens — colors, type scale, spacing, radii.
                    Single source of truth; never hardcode hex in components.
  core/             Game-agnostic infrastructure shared by every game:
    ui/             Primitives (Text, Screen, Button, GameTile, Placeholder)
    navigation/     Root stack + route types
    identity/       Device id + nickname (no login)
    games/          GameManifest type the Home hub renders
  screens/          App-level screens (Home hub)
  games/
    quiz/           Football quiz (Game 1) — its screens live here
    registry.ts     Which games the hub shows
```

## Run on a physical iPhone (USB-C)

> The simulator and Expo Go are not used. Build to a connected device.

1. Install pods (already done once; re-run after adding native deps):

   ```sh
   pod install --project-directory=ios
   ```

2. **Set the signing team once** (free personal signing is fine): open the
   workspace and pick your Apple ID team under *Signing & Capabilities*:

   ```sh
   xed ios/Miflo.xcworkspace
   ```

   Select the **Miflo** target → Signing & Capabilities → Team. You may need to
   change the bundle identifier to something unique (e.g. `com.<you>.miflo`).

3. With the iPhone connected and trusted, run from the CLI:

   ```sh
   npx react-native run-ios --device
   ```

   (List device names with `xcrun xctrace list devices` if needed:
   `npx react-native run-ios --device "My iPhone"`.)

On first launch you may need to trust the developer profile on the phone under
*Settings → General → VPN & Device Management*.

## Fonts

Satoshi (Regular + Medium) is bundled in `assets/fonts` and linked into the iOS
project. See `assets/fonts/README.md` if you ever need to re-link.

## Milestones

- **M0** — Scaffold, navigation, theme/tokens, Satoshi, placeholder on device ✅
- **M1** — Static UI for all eight screens (mock data, pixel-matched)
- **M2** — Supabase schema, seed questions, content fetch
- **M3** — Realtime rooms: create/join by code, lobby presence, host start
- **M4** — Full synced game loop with scoring
- **M5** — Persist `game_results` + profile/score-history stub
