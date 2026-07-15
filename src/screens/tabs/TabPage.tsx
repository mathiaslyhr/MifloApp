import React from 'react';
import {StyleSheet, View} from 'react-native';
// Gesture-handler's ScrollView, not RN's: a card's swipe-right pan has to claim
// priority over the vertical scroll (via blocksExternalGesture), which only
// works when the scrollable is one it recognises. It wraps RN's ScrollView, so
// pages that never swipe are unaffected.
import {ScrollView} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppMark, closeOpenSwipeReveal, NAV_HEIGHT, Screen, Text} from '../../core/ui';
import {spacing} from '../../theme';

type Props = {
  /** Scroll-away page title; omit it to show the brand mark instead (Home). */
  title?: string;
  /** Optional corner element pinned to the header row's right edge. */
  right?: React.ReactNode;
  /** Needed only by pages holding a SwipeReveal — it hands the pan the
   * scrollable to block. */
  scrollRef?: React.RefObject<ScrollView | null>;
  children?: React.ReactNode;
};

/**
 * The bare tab-page scaffold every shell page starts from: a scroll view whose
 * header (title or brand mark) is the first content item so it slides off the
 * top (Instagram-style), and bottom padding that clears the shared nav island.
 * Content scrolls clean under the clock.
 */
export function TabPage({title, right, scrollRef, children}: Props) {
  const insets = useSafeAreaInsets();
  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away) and the shell nav owns the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        // A no-op on pages with nothing revealed; keeps an open swipe from
        // hanging around once the page scrolls under it.
        onScrollBeginDrag={closeOpenSwipeReveal}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.header, !title && styles.headerMark]}>
          {title ? (
            <Text variant="wordmark" align="center">
              {title}
            </Text>
          ) : (
            <AppMark size={28} />
          )}
          {right ? <View style={styles.headerRight}>{right}</View> : null}
        </View>
        {children}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  header: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The brand mark sits at the leading edge (the Home convention); titled
  // pages center their wordmark.
  headerMark: {alignItems: 'flex-start'},
  // Corner element pinned to the header row's right edge.
  headerRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
