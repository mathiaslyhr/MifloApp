import React from 'react';
import {
  AccessibilityRole,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {radii, spacing, useColors} from '../../theme';
import {PressableScale} from './PressableScale';

type Props = {
  children: React.ReactNode;
  /** Omit to render a plain, non-pressable tag. */
  onPress?: () => void;
  disabled?: boolean;
  /** `'sm'` → compact roster tags (lobby), `'md'` → roomier pick tags (voting). */
  size?: 'sm' | 'md';
  /**
   * Border width is always reserved (never conditional) so toggling `accent`
   * can't resize the tag mid-list.
   */
  borderWidth?: 1 | 2;
  /** Brand-purple rim — "you" in the lobby, selected states. */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
};

/**
 * A pill tag — the wearable unit (player names, vote targets, round
 * counters). Surface-2 fill: one step above the card it usually sits on
 * (design.md). No `overflow: 'hidden'` anywhere so children may straddle the
 * rim (the lobby's HOST badge sits above the top border).
 */
export function Tag({
  children,
  onPress,
  disabled = false,
  size = 'md',
  borderWidth = 1,
  accent = false,
  style,
  accessibilityRole,
  accessibilityLabel,
}: Props) {
  const colors = useColors();
  const tagStyle = [
    styles.tag,
    size === 'sm' ? styles.sm : styles.md,
    {
      backgroundColor: colors.surface2,
      borderWidth,
      borderColor: accent ? colors.primary : colors.divider,
    },
    style,
  ];

  if (!onPress && !accessibilityRole) {
    return <View style={tagStyle}>{children}</View>;
  }
  return (
    <PressableScale
      style={tagStyle}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
  },
  sm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  md: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
