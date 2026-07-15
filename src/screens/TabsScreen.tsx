import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeTab} from './tabs/HomeTab';
import {DailyTab} from './tabs/DailyTab';
import {PlayTab} from './tabs/PlayTab';
import {ProfileTab} from './tabs/ProfileTab';
import {
  FloatingBar,
  IslandTabBar,
  useReduceMotion,
  type TabId,
} from '../core/ui';
import {motion} from '../theme';
import {useRequestsStore} from '../core/social/requestsStore';
import type {RootStackParamList} from '../core/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Tabs'>;

const TABS: TabId[] = ['home', 'daily', 'play', 'profile'];
/** How far the arriving page lifts as it fades in. */
const RISE = 8;

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
 * The switch is a cross-fade, and it cheats: rather than fading the old page
 * out and the new one in together (which lands both at ~0.5 mid-way — opacity
 * doesn't composite additively, so you'd see the background bleed through as a
 * dip), the incoming page fades up ON TOP of the outgoing one, which just sits
 * there at full opacity until it's covered and then snaps to 0 offscreen. That
 * only works because every page paints an opaque background (`Screen` lays down
 * an absoluteFill fill, and all four pages go through it). If a page ever
 * becomes transparent, this has to fall back to the dip.
 *
 * The nav island lives here — one shared instance pinned over all four pages,
 * so content scrolls beneath it consistently (Instagram-style).
 */
export function TabsScreen({route}: Props) {
  // Resolved once, up front, rather than starting at 'home' and correcting in
  // an effect: a deep link into Profile would otherwise render Home for a frame
  // and then visibly cross-fade off it. (With the old instant toggle that was a
  // 1-frame blip nobody saw; at 300ms it's a bug you can read.)
  const initialTab = useRef<TabId>(
    route.params?.tab ?? (route.params?.addCode ? 'profile' : 'home'),
  ).current;
  const [tab, setTab] = useState<TabId>(initialTab);
  const addCode = route.params?.addCode;
  // A pending friend request badges Profile — the tab that now holds the
  // friends list. Without a Friends tab of its own, this dot is the only thing
  // that says someone is waiting on you, so it's load-bearing.
  const requests = useRequestsStore(s => s.requests);
  const hasRequests = (requests?.incoming.length ?? 0) > 0;

  // One value per page, not a single interpolated index: an index sweeping
  // 0 → 3 would drag the intermediate pages through visible opacity on a
  // home → profile jump, flashing Daily and Play on the way.
  const progress = useRef(
    Object.fromEntries(
      TABS.map(id => [id, new Animated.Value(id === initialTab ? 1 : 0)]),
    ) as Record<TabId, Animated.Value>,
  ).current;

  const prevTab = useRef(tab);
  useEffect(() => {
    const from = prevTab.current;
    if (from === tab) {
      return;
    }
    prevTab.current = tab;
    Animated.timing(progress[tab], {
      toValue: 1,
      duration: motion.duration.slow,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start(({finished}) => {
      // The outgoing page is fully covered by now, so dropping it is invisible.
      //
      // Unless you switched away and straight back inside the 300ms, in which
      // case this callback is stale and `from` is the tab you're now looking
      // at — zeroing it would blank the live page. `finished` doesn't catch
      // that: this animation completed normally, it's the destination that
      // moved. An interrupted one (finished: false) hasn't covered `from` yet,
      // so it must not hide it either; whichever switch lands last cleans up.
      if (finished && prevTab.current !== from) {
        progress[from].setValue(0);
      }
    });
  }, [tab, progress]);

  // Pushes/deep links jump into a tab: a tap navigates to Tabs with {tab, at}
  // and this effect flips the local toggle. Keyed on the params object (`at`
  // keeps repeat taps distinct) so every tap lands. A friend-code link
  // (miflo.dk/add/CODE) carries no tab and means Profile → Friends, which is
  // where the code gets sent. The first params are already baked into
  // `initialTab` above; this is for every set after that.
  useEffect(() => {
    if (route.params?.tab || route.params?.addCode) {
      setTab(route.params.tab ?? (route.params.addCode ? 'profile' : 'home'));
    }
  }, [route.params]);

  // Reactive rather than the imperative read: this decides the transform at
  // RENDER time, so flipping the OS setting with the app open has to re-render
  // to take hold. The shell renders only on a tab change, so it's free.
  const reduceMotion = useReduceMotion();

  const pageProps = (id: TabId) => ({
    style: [
      styles.page,
      // The active page paints over the one it's replacing.
      tab === id && styles.onTop,
      {
        opacity: progress[id],
        // Reduce Motion: opacity only, no rise. Same bargain as the press zoom.
        transform: reduceMotion
          ? []
          : [
              {
                translateY: progress[id].interpolate({
                  inputRange: [0, 1],
                  outputRange: [RISE, 0],
                }),
              },
            ],
      },
    ],
    // Touch and VoiceOver are gated on the state commit, NOT on the animation
    // finishing. The outgoing page stays visible for 300ms after this flips,
    // and that's correct: a visible-but-dead page is fine, a tappable ghost
    // underneath the new one is not. Don't "fix" this by moving it into the
    // animation callback.
    pointerEvents: tab === id ? ('auto' as const) : ('none' as const),
    accessibilityElementsHidden: tab !== id,
    importantForAccessibility:
      tab === id ? ('auto' as const) : ('no-hide-descendants' as const),
  });

  return (
    <View style={styles.root}>
      <Animated.View {...pageProps('home')}>
        <HomeTab />
      </Animated.View>
      <Animated.View {...pageProps('daily')}>
        <DailyTab />
      </Animated.View>
      <Animated.View {...pageProps('play')}>
        <PlayTab />
      </Animated.View>
      <Animated.View {...pageProps('profile')}>
        <ProfileTab
          isActive={tab === 'profile'}
          addCode={addCode}
        />
      </Animated.View>

      {/* Shared nav island, pinned over every tab page.
          The explicit zIndex is load-bearing, not decoration: the active page
          carries zIndex 1 (see `onTop`), and zIndex outranks declaration order,
          so without a higher one here the page paints straight over the island
          and the navbar disappears. Anything stacked above the pages needs a
          number of its own — an absent zIndex is 0 and loses. */}
      <FloatingBar edge="bottom" style={styles.nav}>
        <IslandTabBar active={tab} onSelect={setTab} badge={{profile: hasRequests}} />
      </FloatingBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  page: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  // The arriving page paints over the one it's replacing. Keep this below
  // `nav` — see the note on the FloatingBar above.
  onTop: {zIndex: 1},
  nav: {zIndex: 2},
});
