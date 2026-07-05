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
import {TicTacToeScreen} from '../../screens/TicTacToeScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Tabs" component={TabsScreen} />
      <Stack.Screen name="Join" component={JoinScreen} />
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      {/* No swipe-back out of a live game; you leave via the result screen. */}
      <Stack.Screen
        name="TicTacToe"
        component={TicTacToeScreen}
        options={{gestureEnabled: false}}
      />
    </Stack.Navigator>
  );
}
