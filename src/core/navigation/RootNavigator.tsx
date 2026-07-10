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
import {ScoutScreen} from '../../screens/ScoutScreen';
import {TopBinsScreen} from '../../screens/TopBinsScreen';
import {ProfileScreen} from '../../screens/menu/ProfileScreen';
import {SettingsScreen} from '../../screens/menu/SettingsScreen';
import {HowToPlayScreen} from '../../screens/menu/HowToPlayScreen';
import {AboutScreen} from '../../screens/menu/AboutScreen';
import {OneDeviceScreen} from '../../screens/menu/OneDeviceScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Tabs" component={TabsScreen} />
      <Stack.Screen name="Join" component={JoinScreen} />
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="GamePicker" component={GamePickerScreen} />
      {/* No swipe-back out of a live game; you leave via the result screen. */}
      <Stack.Screen
        name="Hattrick"
        component={HattrickScreen}
        options={{gestureEnabled: false}}
      />
      {/* No swipe-back out of a live game; you leave via the result screen. */}
      <Stack.Screen
        name="RedCard"
        component={RedCardScreen}
        options={{gestureEnabled: false}}
      />
      {/* Pass-and-play on one shared phone — roomless, fully offline. */}
      <Stack.Screen
        name="HattrickLocal"
        component={HattrickLocalScreen}
        options={{gestureEnabled: false}}
      />
      <Stack.Screen
        name="RedCardLocal"
        component={RedCardLocalScreen}
        options={{gestureEnabled: false}}
      />
      {/* Single-player daily puzzles; leave via the header back button. */}
      <Stack.Screen
        name="Scout"
        component={ScoutScreen}
        options={{gestureEnabled: false}}
      />
      <Stack.Screen
        name="TopBins"
        component={TopBinsScreen}
        options={{gestureEnabled: false}}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="OneDevice" component={OneDeviceScreen} />
    </Stack.Navigator>
  );
}
