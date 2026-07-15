import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
// Gesture-handler's ScrollView, so in-page swipe gestures (e.g. the friend
// rows' swipe-to-remove) can claim priority via blocksExternalGesture.
import {ScrollView} from 'react-native-gesture-handler';
import {ChevronLeft} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CircleButton, FloatingBar, Screen, Text} from '../../core/ui';
import {screenPadding, spacing, useColors} from '../../theme';

type Props = {
  title: string;
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
  /** Extra style for the scroll content (e.g. a `gap` between sections). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Exposes the scroll view to children's swipe gestures (SwipeReveal). */
  scrollRef?: React.RefObject<ScrollView | null>;
};

/**
 * Shared layout for the menu detail pages (Profile, Settings, How to play,
 * About). The content sits in a full-height ScrollView on the page background.
 * The wordmark title lives in the scroll flow, so it scrolls off the top;
 * only the back button stays pinned as a floating corner button so back is
 * always reachable.
 */
export function MenuDetailScreen({
  title,
  onBack,
  backLabel = 'Back',
  children,
  contentStyle,
  scrollRef,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  return (
    // Drop the top safe-area edge — the scroll content owns the top inset so the
    // wordmark scrolls away; back stays pinned as a floating corner button.
    <Screen canvas edges={['left', 'right', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark title — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.titleHeader}>
          <Text variant="wordmark" align="center" numberOfLines={1}>
            {title}
          </Text>
        </View>

        {children}
      </ScrollView>

      {/* Pinned back button (left) — stays put while the title scrolls away. */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton size={36} accessibilityLabel={backLabel} onPress={onBack}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
        </View>
      </FloatingBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  titleHeader: {height: 44, alignItems: 'center', justifyContent: 'center'},
  chromeBar: {paddingHorizontal: screenPadding},
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
  },
  chromeSpacer: {flex: 1},
});
