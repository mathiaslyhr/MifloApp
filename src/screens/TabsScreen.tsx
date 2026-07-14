import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeTab} from './tabs/HomeTab';
import {DailyTab} from './tabs/DailyTab';
import {PlayTab} from './tabs/PlayTab';
import {ProfileTab} from './tabs/ProfileTab';
import {FloatingBar, IslandTabBar, type TabId} from '../core/ui';
import type {RootStackParamList} from '../core/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Tabs'>;

/**
 * The tab shell — the stack's home route. A minimal, hand-rolled toggle between
 * Home, Daily, Play and Profile. All four stay mounted; we flip visibility
 * instead of swapping, so switching tabs never tears down and re-renders a
 * page's native views (a visible flash otherwise).
 *
 * Hidden pages are faded (`opacity: 0`), NOT `display: none`: Fabric culls
 * `display: none` subtrees — their native views are destroyed and recreated on
 * every toggle — which silently detaches anything bound to a native view, like
 * gesture-handler recognizers. Opacity keeps the native views truly alive
 * (which is also what the "stay mounted" design wanted all along). Touch and
 * VoiceOver are gated separately via `pointerEvents` /
 * `accessibilityElementsHidden`.
 *
 * The blurred nav island lives here — one shared instance pinned over all four
 * pages, so content scrolls and blurs beneath it consistently (Instagram-style).
 */
export function TabsScreen({route}: Props) {
  const [tab, setTab] = useState<TabId>('home');
  // Pushes/deep links jump into a tab: a tap navigates to Tabs with {tab, at}
  // and this effect flips the local toggle. Keyed on the params object (`at`
  // keeps repeat taps distinct) so every tap lands.
  // TODO(sitemap): `addCode` (miflo.dk/add/CODE) used to land on the Friends
  // tab, which auto-sent the request; re-wire once friends live somewhere.
  useEffect(() => {
    if (route.params?.tab || route.params?.addCode) {
      setTab(route.params.tab ?? 'home');
    }
  }, [route.params]);

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
        <HomeTab />
      </View>
      <View {...pageProps('daily')}>
        <DailyTab />
      </View>
      <View {...pageProps('play')}>
        <PlayTab />
      </View>
      <View {...pageProps('profile')}>
        <ProfileTab />
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
