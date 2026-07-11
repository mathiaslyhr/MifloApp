import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useRequestsStore} from '../core/social/requestsStore';
import {HomeScreen} from './HomeScreen';
import {GamesScreen} from './GamesScreen';
import {SocialScreen} from './SocialScreen';
import {ProfileScreen} from './ProfileScreen';
import {FloatingBar, IslandTabBar, type TabId} from '../core/ui';
import type {RootStackParamList} from '../core/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Tabs'>;

/**
 * The tab shell — the stack's home route. A minimal, hand-rolled toggle between
 * Home, Games, Friends and Profile. All four stay mounted; we flip visibility
 * instead of swapping, so switching tabs never re-rasterizes a screen's rainbow
 * mesh SVG (a visible flash otherwise).
 *
 * Hidden pages are faded (`opacity: 0`), NOT `display: none`: Fabric culls
 * `display: none` subtrees — their native views are destroyed and recreated on
 * every toggle — which silently detaches anything bound to a native view, like
 * the gesture-handler recognizers on the Games tiles' swipe-reveal. Opacity
 * keeps the native views truly alive (which is also what the "stay mounted"
 * design wanted all along). Touch and VoiceOver are gated separately via
 * `pointerEvents` / `accessibilityElementsHidden`.
 *
 * The blurred nav island lives here — one shared instance pinned over all four
 * pages, so content scrolls and blurs beneath it consistently (Instagram-style).
 * Home's Create button pushes the Lobby; Profile's hamburger pushes the Menu.
 */
export function TabsScreen({route}: Props) {
  const [tab, setTab] = useState<TabId>('home');
  // Friend pushes deep-link into a tab: a tap navigates to Tabs with
  // {tab, at} and this effect flips the local toggle. Keyed on the params
  // object (`at` keeps repeat taps distinct) so every tap lands. An `addCode`
  // (miflo.dk/add/CODE link) lands on Friends too — SocialScreen consumes it.
  useEffect(() => {
    if (route.params?.tab || route.params?.addCode) {
      setTab(route.params.tab ?? 'social');
    }
  }, [route.params]);

  // Badge the Friends tab while requests await an answer.
  const hasIncoming = useRequestsStore(
    s => (s.requests?.incoming.length ?? 0) > 0,
  );

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
      <View {...pageProps('social')}>
        {/* Stays mounted like the others; isActive is its focus signal (it has
            no navigation focus of its own), used to refresh the friends feed. */}
        <SocialScreen isActive={tab === 'social'} addCode={route.params?.addCode} />
      </View>
      <View {...pageProps('profile')}>
        {/* Same isActive pattern as Friends: the page stays mounted, so the
            flag is its focus signal, used to reload the daily archive. */}
        <ProfileScreen isActive={tab === 'profile'} />
      </View>

      {/* Shared blurred nav island, pinned over every tab page. */}
      <FloatingBar edge="bottom">
        <IslandTabBar
          active={tab}
          onSelect={setTab}
          badge={{social: hasIncoming}}
        />
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
