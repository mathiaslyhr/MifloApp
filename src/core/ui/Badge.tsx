import React from 'react';
import {StyleSheet, View} from 'react-native';
import {colors, radii, spacing} from '../../theme';
import {Text} from './Text';

type BadgeTone = 'host' | 'you';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

/**
 * Small pill tag next to a name. `host` is a muted navy chip; `you` takes the
 * accent to mark the current player.
 */
export function Badge({label, tone = 'host'}: BadgeProps) {
  const isYou = tone === 'you';
  return (
    <View style={[styles.base, isYou ? styles.you : styles.host]}>
      <Text
        variant="caption"
        color={isYou ? 'textPrimary' : 'onPrimary'}
        style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  host: {
    backgroundColor: colors.badgeHost,
  },
  you: {
    backgroundColor: colors.primary,
  },
  label: {
    fontWeight: '500',
  },
});
