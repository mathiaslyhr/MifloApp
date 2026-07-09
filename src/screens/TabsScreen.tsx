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
 * Hidden pages are faded (`opacity: 0`), NOT `display: none`: Fabric culls
 * `display: none` subtrees — their native views are destroyed and recreated on
 * every toggle — which silently detaches anything bound to a native view, like
 * the gesture-handler recognizers on the Games tiles' swipe-reveal. Opacity
 * keeps the native views truly alive (which is also what the "stay mounted"
 * design wanted all along). Touch and VoiceOver are gated separately via
 * `pointerEvents` / `accessibilityElementsHidden`.
 *
 * The blurred nav island lives here — one shared instance pinned over all three
 * pages, so content scrolls and blurs beneath it consistently (Instagram-style).
 * Menu rows push their detail screen on the root stack; Home's Create button
 * pushes the Lobby.
 */
export function TabsScreen({navigation}: Props) {
  const [tab, setTab] = useState<TabId>('home');

  const pageProps = (id: TabId) => ({
    style: [styles.page, tab !== id && styles.hidden],
    pointerEvents: tab === id ? ('auto' as const) : ('none' as const),
    accessibilityElementsHidden: tab !== id,
    importantForAccessibility:
      tab === id ? ('auto' as const) : ('no-hide-descendants' as const),
  });

  return (
    <View style={styles.root}>
      <View {...pageProps('home')}>
        <HomeScreen />
      </View>
      <View {...pageProps('games')}>
        <GamesScreen />
      </View>
      <View {...pageProps('menu')}>
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
  // NOT display:none — see the shell comment above (Fabric culling).
  hidden: {opacity: 0},
});
