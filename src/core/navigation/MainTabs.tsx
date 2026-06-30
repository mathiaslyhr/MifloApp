import React from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import type {MainTabParamList} from './types';
import {IslandTabBar} from '../ui/IslandTabBar';
import {HomeScreen} from '../../screens/HomeScreen';
import {GamesScreen} from '../../screens/GamesScreen';
import {MenuScreen} from '../../screens/MenuScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Hoisted so the navigator doesn't get a new component identity each render.
const renderTabBar = (props: BottomTabBarProps) => <IslandTabBar {...props} />;

/**
 * The app shell: three tabs behind a floating island bar. The bar is rendered
 * by `IslandTabBar` and overlays the screens, so each tab screen self-pads its
 * scroll content (via `useIslandInset`) rather than reserving layout space here.
 */
export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{headerShown: false}}
      tabBar={renderTabBar}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Games" component={GamesScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
    </Tab.Navigator>
  );
}
