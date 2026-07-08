import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CircleButton, FloatingBar, Screen, Text, TopStatusFade} from '../../core/ui';
import {colors, screenPadding, spacing} from '../../theme';

type Props = {
  title: string;
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
  /** Extra style for the scroll content (e.g. a `gap` between sections). */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Shared layout for the menu detail pages (Profile, Settings, How to play,
 * About). The content sits in a full-height ScrollView on the rainbow canvas.
 * The wordmark title lives in the scroll flow, so it scrolls up and dissolves
 * under the frosted top fade; only the back button stays pinned as a floating
 * corner button so back is always reachable.
 */
export function MenuDetailScreen({
  title,
  onBack,
  backLabel = 'Back',
  children,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    // Drop the top safe-area edge — the scroll content owns the top inset so the
    // wordmark scrolls away; back stays pinned as a floating corner button.
    <Screen canvas edges={['left', 'right', 'bottom']}>
      <ScrollView
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

      {/* Frosted fade under the status bar so the title dissolves as it scrolls. */}
      <TopStatusFade />
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
