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
import {HattrickScreen} from '../../screens/HattrickScreen';
import {HattrickLocalScreen} from '../../screens/HattrickLocalScreen';
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
import {FriendProfileScreen} from '../../screens/profile/FriendProfileScreen';
import {SettingsScreen} from '../../screens/menu/SettingsScreen';
import {HowToPlayScreen} from '../../screens/menu/HowToPlayScreen';
import {AboutScreen} from '../../screens/menu/AboutScreen';
import {OneDeviceScreen} from '../../screens/menu/OneDeviceScreen';
import {MoveToPhoneScreen} from '../../screens/menu/MoveToPhoneScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    // Swipe-back is off everywhere: every pushed page has an explicit back
    // button, and edge swipes kept colliding with in-page gestures (game
    // boards, swipe-reveal rows).
    //
    // The push transition is deliberately left at the platform default — this
    // was evaluated during the motion-system pass and kept on purpose. iOS
    // substitutes a cross-dissolve for the slide when Reduce Motion is on, but
    // only while the transition IS the default; naming one explicitly
    // (`animation: 'fade'`, `'slide_from_right'`, …) pins it and forfeits that
    // accommodation for free. `presentation: 'modal'` is off the table for the
    // same reason as swipe-back: it reintroduces the swipe-down dismiss this
    // navigator turns off. Don't add transition options here without a reason
    // that outweighs losing the OS behaviour.
    <Stack.Navigator screenOptions={{headerShown: false, gestureEnabled: false}}>
      <Stack.Screen name="Tabs" component={TabsScreen} />
      <Stack.Screen name="Join" component={JoinScreen} />
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="GamePicker" component={GamePickerScreen} />
      <Stack.Screen name="Hattrick" component={HattrickScreen} />
      <Stack.Screen name="RedCard" component={RedCardScreen} />
      <Stack.Screen name="Offside" component={OffsideScreen} />
      <Stack.Screen name="CultHero" component={CultHeroScreen} />
      {/* Competitive Hattrick — matchmaking then the live ranked match. */}
      <Stack.Screen name="RankedSearch" component={RankedSearchScreen} />
      <Stack.Screen name="RankedHattrick" component={RankedHattrickScreen} />
      <Stack.Screen name="RankedLeaderboard" component={RankedLeaderboardScreen} />
      {/* Pass-and-play on one shared phone — roomless, fully offline. */}
      <Stack.Screen name="HattrickLocal" component={HattrickLocalScreen} />
      <Stack.Screen name="RedCardLocal" component={RedCardLocalScreen} />
      <Stack.Screen name="OffsideLocal" component={OffsideLocalScreen} />
      <Stack.Screen name="CultHeroLocal" component={CultHeroLocalScreen} />
      {/* Single-player daily puzzles; leave via the header back button. */}
      <Stack.Screen name="Scout" component={ScoutScreen} />
      <Stack.Screen name="TopBins" component={TopBinsScreen} />
      <Stack.Screen name="Journeyman" component={JourneymanScreen} />
      <Stack.Screen name="Teamsheet" component={TeamsheetScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="FriendsList" component={FriendsListScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="OneDevice" component={OneDeviceScreen} />
      <Stack.Screen name="MoveToPhone" component={MoveToPhoneScreen} />
    </Stack.Navigator>
  );
}
