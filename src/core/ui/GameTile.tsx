import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChevronRight, type LucideIcon} from 'lucide-react-native';
import {colors, radii, spacing} from '../../theme';
import {PressableScale} from './PressableScale';
import {Text} from './Text';

type Props = {
  title: string;
  tagline?: string;
  Icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Dim the tile and ignore taps (e.g. a game that isn't built yet). */
  disabled?: boolean;
  /** Small pill next to the title, e.g. "Coming soon". */
  badge?: string;
};

/**
 * A full-width glass card for the Games hub: an accent icon badge, the game
 * title + a one-line tagline, and a trailing chevron. Reuses the "clear"
 * frosted-glass language (glassLight fill, glassRim rim, soft lift shadow) from
 * CircleButton / IslandTabBar, and the shared springy press-scale via
 * PressableScale.
 */
export function GameTile({
  title,
  tagline,
  Icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  badge,
}: Props) {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={disabled ? {disabled: true} : undefined}
      style={[styles.card, disabled && styles.cardDisabled]}>
      <View style={styles.badge}>
        <Icon size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="section">{title}</Text>
          {badge ? (
            <View style={styles.pill}>
              <Text variant="caption" color="secondary" style={styles.pillText}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        {tagline ? (
          <Text variant="secondary" color="secondary">
            {tagline}
          </Text>
        ) : null}
      </View>
      {!disabled ? (
        <ChevronRight size={22} color={colors.textTertiary} strokeWidth={2} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    // "Clear" frosted glass — matches the nav island / secondary button.
    backgroundColor: colors.glassLight,
    borderColor: colors.glassRim,
    shadowColor: '#140F32',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 4,
  },
  cardDisabled: {opacity: 0.5},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  pillText: {fontSize: 11, lineHeight: 14, letterSpacing: 0.3},
  badge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card - 4,
    backgroundColor: colors.surface2,
  },
  body: {flex: 1, gap: 2},
});
