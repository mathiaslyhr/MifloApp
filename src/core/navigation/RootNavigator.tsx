import React from 'react';
import {DarkTheme, NavigationContainer, type Theme as NavTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {colors, fontFamily} from '../../theme';
import type {RootStackParamList} from './types';
import {MainTabs} from './MainTabs';
import {StatsScreen} from '../../screens/StatsScreen';
import {ProfileScreen} from '../../screens/ProfileScreen';
import {SettingsScreen} from '../../screens/SettingsScreen';
import {FaqScreen} from '../../screens/FaqScreen';
import {JoinScreen, LobbyScreen} from '../rooms/screens';
import {
  CreateGameScreen,
  QuestionScreen,
  PodiumScreen,
} from '../../games/quiz/screens';
import {
  CreateGameScreen as OddOneOutCreateScreen,
  QuestionScreen as OddOneOutQuestionScreen,
  PodiumScreen as OddOneOutPodiumScreen,
} from '../../games/odd-one-out/screens';
import {
  CreateGameScreen as MissingXiCreateScreen,
  QuestionScreen as MissingXiQuestionScreen,
  PodiumScreen as MissingXiPodiumScreen,
} from '../../games/missing-xi/screens';
// Side-effect imports: register each game's room config for the shared lobby.
import '../../games/quiz/room';
import '../../games/odd-one-out/room';
import '../../games/missing-xi/room';

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
          name="Main"
          component={MainTabs}
          options={{headerShown: false}}
        />
        {/* Menu detail screens, pushed above the tab shell. */}
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Faq"
          component={FaqScreen}
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
        {/* Odd One Out */}
        <Stack.Screen
          name="OddOneOutCreate"
          component={OddOneOutCreateScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="OddOneOutQuestion"
          component={OddOneOutQuestionScreen}
          options={{headerShown: false, gestureEnabled: false}}
        />
        <Stack.Screen
          name="OddOneOutPodium"
          component={OddOneOutPodiumScreen}
          options={{headerShown: false, gestureEnabled: false}}
        />
        {/* Missing XI */}
        <Stack.Screen
          name="MissingXiCreate"
          component={MissingXiCreateScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="MissingXiQuestion"
          component={MissingXiQuestionScreen}
          options={{headerShown: false, gestureEnabled: false}}
        />
        <Stack.Screen
          name="MissingXiPodium"
          component={MissingXiPodiumScreen}
          options={{headerShown: false, gestureEnabled: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
