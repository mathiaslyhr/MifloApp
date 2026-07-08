import React, {useState} from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FloatingBar, PageHeader, Screen} from '../../core/ui';
import {screenPadding, spacing} from '../../theme';

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
 * About). The content sits in a full-height ScrollView on the rainbow canvas and
 * blurs *behind* a pinned frosted header (back button + title), which stays put
 * so back is always reachable. The header reports its height so the content
 * reserves matching top clearance and scrolls beneath it.
 */
export function MenuDetailScreen({
  title,
  onBack,
  backLabel,
  children,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const [headerH, setHeaderH] = useState(0);

  return (
    // Drop the top/bottom safe-area edges so the scroll region runs the full
    // height; the floating header owns the top inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          {
            paddingTop: headerH + spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>

      {/* Pinned frosted header — the content blurs behind it. Pad it
          horizontally so the back button lines up with the content (16px). */}
      <FloatingBar edge="top" blur onHeight={setHeaderH} style={styles.bar}>
        <PageHeader title={title} onBack={onBack} backLabel={backLabel} />
      </FloatingBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  bar: {paddingHorizontal: screenPadding},
});
