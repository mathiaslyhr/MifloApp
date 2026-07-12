/**
 * The root native-stack. `Tabs` (the Home/Games/Menu chrome) is the initial
 * route; native-stack keeps it mounted when a screen is pushed on top, so
 * returning from the Lobby never re-rasterizes the tab shell's rainbow mesh.
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
import {JourneymanScreen} from '../../screens/JourneymanScreen';
import {TeamsheetScreen} from '../../screens/TeamsheetScreen';
import {ScoutScreen} from '../../screens/ScoutScreen';
import {TopBinsScreen} from '../../screens/TopBinsScreen';
import {MenuScreen} from '../../screens/menu/MenuScreen';
import {FriendsListScreen} from '../../screens/profile/FriendsListScreen';
import {FriendProfileScreen} from '../../screens/profile/FriendProfileScreen';
import {HeadToHeadScreen} from '../../screens/profile/HeadToHeadScreen';
import {SettingsScreen} from '../../screens/menu/SettingsScreen';
import {HowToPlayScreen} from '../../screens/menu/HowToPlayScreen';
import {AboutScreen} from '../../screens/menu/AboutScreen';
import {OneDeviceScreen} from '../../screens/menu/OneDeviceScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    // Swipe-back is off everywhere: every pushed page has an explicit back
    // button, and edge swipes kept colliding with in-page gestures (game
    // boards, swipe-reveal rows).
    <Stack.Navigator screenOptions={{headerShown: false, gestureEnabled: false}}>
      <Stack.Screen name="Tabs" component={TabsScreen} />
      <Stack.Screen name="Join" component={JoinScreen} />
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="GamePicker" component={GamePickerScreen} />
      <Stack.Screen name="Hattrick" component={HattrickScreen} />
      <Stack.Screen name="RedCard" component={RedCardScreen} />
      <Stack.Screen name="Offside" component={OffsideScreen} />
      <Stack.Screen name="CultHero" component={CultHeroScreen} />
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
      <Stack.Screen name="HeadToHead" component={HeadToHeadScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="OneDevice" component={OneDeviceScreen} />
    </Stack.Navigator>
  );
}
