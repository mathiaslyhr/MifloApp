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
};

/**
 * A full-width glass card for the Games hub: an accent icon badge, the game
 * title + a one-line tagline, and a trailing chevron. Reuses the "clear"
 * frosted-glass language (glassLight fill, glassRim rim, soft lift shadow) from
 * CircleButton / IslandTabBar, and the shared springy press-scale via
 * PressableScale.
 */
export function GameTile({title, tagline, Icon, onPress, accessibilityLabel}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={styles.card}>
      <View style={styles.badge}>
        <Icon size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text variant="section">{title}</Text>
        {tagline ? (
          <Text variant="secondary" color="secondary">
            {tagline}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={22} color={colors.textTertiary} strokeWidth={2} />
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
