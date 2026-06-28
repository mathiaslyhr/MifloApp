import React from 'react';
import {DarkTheme, NavigationContainer, type Theme as NavTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {colors, fontFamily} from '../../theme';
import type {RootStackParamList} from './types';
import {HomeScreen} from '../../screens/HomeScreen';
import {
  CreateGameScreen,
  JoinScreen,
  LobbyScreen,
  QuestionScreen,
  RevealScreen,
  LeaderboardScreen,
  PodiumScreen,
} from '../../games/quiz/screens';

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
          name="QuizCreate"
          component={CreateGameScreen}
          options={{title: 'Create game'}}
        />
        <Stack.Screen
          name="QuizJoin"
          component={JoinScreen}
          options={{title: 'Join game'}}
        />
        <Stack.Screen
          name="QuizLobby"
          component={LobbyScreen}
          options={{title: 'Lobby'}}
        />
        <Stack.Screen
          name="QuizQuestion"
          component={QuestionScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="QuizReveal"
          component={RevealScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="QuizLeaderboard"
          component={LeaderboardScreen}
          options={{title: 'Standings'}}
        />
        <Stack.Screen
          name="QuizPodium"
          component={PodiumScreen}
          options={{headerShown: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
