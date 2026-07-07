/**
 * Root navigation types. The app is a native-stack: the `Tabs` route hosts the
 * Home/Games/Menu shell (its own local tab toggle), and screens outside the
 * chrome — Lobby now, Join next — are pushed on top.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Tabs: undefined;
  Join: undefined;
  Lobby: {roomId: string};
  TicTacToe: {roomId: string};
  FootballerImposter: {roomId: string};
  MysteryFootballer: undefined;
  Profile: undefined;
  Settings: undefined;
  HowToPlay: undefined;
  About: undefined;
};

/** Typed navigation prop for screens that push/pop the root stack. */
export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

/** Typed `useNavigation` for screens inside the tab shell (e.g. Home). */
export const useAppNavigation = () => useNavigation<RootNavigation>();
