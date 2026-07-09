import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeScreen} from './HomeScreen';
import {GamesScreen} from './GamesScreen';
import {MenuScreen, type MenuItem} from './MenuScreen';
import {FloatingBar, IslandTabBar, type TabId} from '../core/ui';
import type {RootStackParamList} from '../core/navigation';

/** Menu row → the detail route it opens (all param-less). */
type DetailRoute = 'Profile' | 'Settings' | 'HowToPlay' | 'About' | 'OneDevice';
const MENU_ROUTES: Record<MenuItem, DetailRoute> = {
  profile: 'Profile',
  settings: 'Settings',
  howToPlay: 'HowToPlay',
  about: 'About',
  oneDevice: 'OneDevice',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Tabs'>;

/**
 * The tab shell — the stack's home route. A minimal, hand-rolled toggle between
 * Home, Games and Menu. All three stay mounted; we flip visibility instead of
 * swapping, so switching tabs never re-rasterizes a screen's rainbow mesh SVG (a
 * visible flash otherwise).
 *
 * The blurred nav island lives here — one shared instance pinned over all three
 * pages, so content scrolls and blurs beneath it consistently (Instagram-style).
 * Menu rows push their detail screen on the root stack; Home's Create button
 * pushes the Lobby.
 */
export function TabsScreen({navigation}: Props) {
  const [tab, setTab] = useState<TabId>('home');

  return (
    <View style={styles.root}>
      <View
        style={[styles.page, tab !== 'home' && styles.hidden]}
        pointerEvents={tab === 'home' ? 'auto' : 'none'}>
        <HomeScreen />
      </View>
      <View
        style={[styles.page, tab !== 'games' && styles.hidden]}
        pointerEvents={tab === 'games' ? 'auto' : 'none'}>
        <GamesScreen />
      </View>
      <View
        style={[styles.page, tab !== 'menu' && styles.hidden]}
        pointerEvents={tab === 'menu' ? 'auto' : 'none'}>
        <MenuScreen
          onSelectItem={item => navigation.navigate(MENU_ROUTES[item])}
        />
      </View>

      {/* Shared blurred nav island, pinned over every tab page. */}
      <FloatingBar edge="bottom">
        <IslandTabBar active={tab} onSelect={setTab} />
      </FloatingBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  page: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  hidden: {display: 'none'},
});
