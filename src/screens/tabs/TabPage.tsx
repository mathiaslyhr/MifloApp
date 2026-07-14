import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppMark, NAV_HEIGHT, Screen, Text, TopStatusFade} from '../../core/ui';
import {spacing} from '../../theme';

type Props = {
  /** Scroll-away page title; omit it to show the brand mark instead (Home). */
  title?: string;
  children?: React.ReactNode;
};

/**
 * The bare tab-page scaffold every shell page starts from: a scroll view whose
 * header (title or brand mark) is the first content item so it slides off the
 * top (Instagram-style), a pinned frosted status-bar fade, and bottom padding
 * that clears the shared nav island.
 */
export function TabPage({title, children}: Props) {
  const insets = useSafeAreaInsets();
  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away) and the shell nav owns the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.header, !title && styles.headerMark]}>
          {title ? (
            <Text variant="wordmark" align="center">
              {title}
            </Text>
          ) : (
            <AppMark size={28} />
          )}
        </View>
        {children}
      </ScrollView>
      <TopStatusFade />
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
});
