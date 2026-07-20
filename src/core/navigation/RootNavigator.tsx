/**
 * The root native-stack. `Tabs` (the Home/Games/Menu chrome) is the initial
 * route; native-stack keeps it mounted when a screen is pushed on top, so
 * returning from the Lobby never tears down the tab shell's native views.
 */
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {TabsScreen} from '../../screens/TabsScreen';
import {JoinScreen} from '../../screens/JoinScreen';
import {LobbyScreen} from '../../screens/LobbyScreen';
import {GamePickerScreen} from '../../screens/GamePickerScreen';
import {GameModeSheet} from '../../screens/GameModeSheet';
import {HattrickScreen} from '../../screens/HattrickScreen';
import {HattrickLocalScreen} from '../../screens/HattrickLocalScreen';
import {HattrickBotScreen} from '../../screens/HattrickBotScreen';
import {RedCardScreen} from '../../screens/RedCardScreen';
import {RedCardLocalScreen} from '../../screens/RedCardLocalScreen';
import {OffsideScreen} from '../../screens/OffsideScreen';
import {OffsideLocalScreen} from '../../screens/OffsideLocalScreen';
import {CultHeroScreen} from '../../screens/CultHeroScreen';
import {CultHeroLocalScreen} from '../../screens/CultHeroLocalScreen';
import {RankedSearchScreen} from '../../screens/RankedSearchScreen';
import {RankedLeaderboardScreen} from '../../screens/RankedLeaderboardScreen';
import {RankedHattrickScreen} from '../../screens/RankedHattrickScreen';
import {JourneymanScreen} from '../../screens/JourneymanScreen';
import {TeamsheetScreen} from '../../screens/TeamsheetScreen';
import {ScoutScreen} from '../../screens/ScoutScreen';
import {TopBinsScreen} from '../../screens/TopBinsScreen';
import {MenuScreen} from '../../screens/menu/MenuScreen';
import {FriendsListScreen} from '../../screens/profile/FriendsListScreen';
import {NotificationsScreen} from '../../screens/NotificationsScreen';
import {FriendProfileScreen} from '../../screens/profile/FriendProfileScreen';
import {SettingsScreen} from '../../screens/menu/SettingsScreen';
import {HowToPlayScreen} from '../../screens/menu/HowToPlayScreen';
import {AboutScreen} from '../../screens/menu/AboutScreen';
import {MoveToPhoneScreen} from '../../screens/menu/MoveToPhoneScreen';
import {useColors} from '../../theme';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Swipe-back OFF. Two different reasons, both real:
 *
 *  - **In-page gestures.** An edge swipe collides with a game board's own
 *    handling, or with a swipe-reveal row (FriendsList's swipe-to-remove).
 *    This is the collision that originally turned the gesture off everywhere.
 *  - **Live state.** Lobby and the online/ranked matches have a room behind
 *    them; leaving is a real action with a real exit flow, not a back button.
 *
 * Everything else — the menu pages, the info pages, the profile pages, the
 * daily puzzles (whose progress persists, so leaving and returning is free) —
 * has neither problem, and turning the gesture off there just cost users the
 * most ingrained navigation gesture on iOS for nothing.
 *
 * Note this list is the exception, not the rule: a new screen gets the platform
 * behaviour by default. If you add a screen with its own horizontal gesture or
 * live server state, add it here.
 */
const NO_SWIPE_BACK = {gestureEnabled: false} as const;

export function RootNavigator() {
  // Only the sheet needs a colour here: a formSheet is drawn by UIKit, whose
  // own backdrop is white. Every other route paints its own canvas.
  const colors = useColors();
  return (
    // The push transition is deliberately left at the platform default — this
    // was evaluated during the motion-system pass and kept on purpose. iOS
    // substitutes a cross-dissolve for the slide when Reduce Motion is on, but
    // only while the transition IS the default; naming one explicitly
    // (`animation: 'fade'`, `'slide_from_right'`, …) pins it and forfeits that
    // accommodation for free. `presentation: 'modal'` is off the table for the
    // same reason as swipe-back: it reintroduces the swipe-down dismiss this
    // navigator turns off. Don't add transition options here without a reason
    // that outweighs losing the OS behaviour.
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Tabs" component={TabsScreen} />
      <Stack.Screen name="Join" component={JoinScreen} />
      {/* Live room behind it — leaving is the explicit Leave match flow. */}
      <Stack.Screen name="Lobby" component={LobbyScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="GamePicker" component={GamePickerScreen} />
      {/* The one deliberate exception to the no-modal note above: this screen
          IS a sheet, so the swipe-down dismiss that rule protects against is
          the whole point. UIKit draws it — grabber, rubber-band, drag — so
          there is no animation code and no Reanimated. `fitToContents` sizes
          it to the two rows instead of a half-screen slab. */}
      <Stack.Screen
        name="GameMode"
        component={GameModeSheet}
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: {backgroundColor: colors.background},
        }}
      />
      {/* Online matches: board gestures + a room that outlives the screen. */}
      <Stack.Screen name="Hattrick" component={HattrickScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="RedCard" component={RedCardScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="Offside" component={OffsideScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="CultHero" component={CultHeroScreen} options={NO_SWIPE_BACK} />
      {/* Competitive Hattrick — matchmaking then the live ranked match. An
          accidental swipe out of a ranked match forfeits it. */}
      <Stack.Screen name="RankedSearch" component={RankedSearchScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="RankedHattrick" component={RankedHattrickScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="RankedLeaderboard" component={RankedLeaderboardScreen} />
      {/* Pass-and-play on one shared phone — roomless, fully offline. Still
          gesture-free: the handoff gate must not be swipeable past. */}
      <Stack.Screen name="HattrickLocal" component={HattrickLocalScreen} options={NO_SWIPE_BACK} />
      {/* Solo Hattrick vs the computer — roomless, offline. */}
      <Stack.Screen name="HattrickBot" component={HattrickBotScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="RedCardLocal" component={RedCardLocalScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="OffsideLocal" component={OffsideLocalScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="CultHeroLocal" component={CultHeroLocalScreen} options={NO_SWIPE_BACK} />
      {/* Single-player daily puzzles — progress persists, so swiping out and
          coming back resumes exactly where you were. */}
      <Stack.Screen name="Scout" component={ScoutScreen} />
      <Stack.Screen name="TopBins" component={TopBinsScreen} />
      <Stack.Screen name="Journeyman" component={JourneymanScreen} />
      <Stack.Screen name="Teamsheet" component={TeamsheetScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      {/* Swipe-to-remove rows: an edge swipe would fight them. */}
      <Stack.Screen name="FriendsList" component={FriendsListScreen} options={NO_SWIPE_BACK} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="MoveToPhone" component={MoveToPhoneScreen} />
    </Stack.Navigator>
  );
}
