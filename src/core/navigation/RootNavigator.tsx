import React from 'react';
import {DarkTheme, NavigationContainer, type Theme as NavTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {colors, fontFamily} from '../../theme';
import type {RootStackParamList} from './types';
import {HomeScreen} from '../../screens/HomeScreen';
import {StatsScreen} from '../../screens/StatsScreen';
import {JoinScreen, LobbyScreen} from '../rooms/screens';
import {
  CreateGameScreen,
  QuestionScreen,
  PodiumScreen,
} from '../../games/quiz/screens';
// Side-effect import: registers each game's room config for the shared lobby.
import '../../games/quiz/room';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** React Navigation theme aligned to Miflo's tokens (black bg, white text). */
const navTheme: NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    border: colors.divider,
    primary: colors.primary,
    text: colors.textPrimary,
    notification: colors.primary,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {backgroundColor: colors.background},
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {fontFamily: fontFamily.medium},
          headerShadowVisible: false,
          contentStyle: {backgroundColor: colors.background},
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{headerShown: false}}
        />
        {/* Shared room screens, used by every game. */}
        <Stack.Screen
          name="Join"
          component={JoinScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Lobby"
          component={LobbyScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="QuizCreate"
          component={CreateGameScreen}
          options={{headerShown: false}}
        />
        {/* In-game screens: no native header, and no swipe-back so a game
            can't be abandoned mid-question by an accidental gesture. */}
        <Stack.Screen
          name="QuizQuestion"
          component={QuestionScreen}
          options={{headerShown: false, gestureEnabled: false}}
        />
        <Stack.Screen
          name="QuizPodium"
          component={PodiumScreen}
          options={{headerShown: false, gestureEnabled: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
