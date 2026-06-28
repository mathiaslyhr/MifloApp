import React from 'react';
import {StyleSheet, Text as RNText, View} from 'react-native';
import {colors, fontFamily} from '../../theme';

type AvatarVariant = 'host' | 'neutral' | 'waiting';

type AvatarProps = {
  /** Display name; the first letter becomes the avatar initial. */
  name?: string;
  variant?: AvatarVariant;
  /** Diameter in points. Defaults to 44. */
  size?: number;
};

/**
 * Round player avatar with an initial. `host` takes the accent fill, `neutral`
 * a muted grey, and `waiting` is a dashed placeholder for empty slots.
 */
export function Avatar({name, variant = 'neutral', size = 44}: AvatarProps) {
  const initial = name ? name.trim().charAt(0).toUpperCase() : '';

  return (
    <View
      style={[
        styles.base,
        {width: size, height: size, borderRadius: size / 2},
        variant === 'host' && styles.host,
        variant === 'neutral' && styles.neutral,
        variant === 'waiting' && styles.waiting,
      ]}>
      {variant === 'waiting' ? (
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      ) : (
        <RNText style={[styles.initial, {fontSize: Math.round(size * 0.4)}]}>
          {initial}
        </RNText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  host: {
    backgroundColor: colors.primary,
  },
  neutral: {
    backgroundColor: colors.avatarNeutral,
  },
  waiting: {
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderStyle: 'dashed',
  },
  initial: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
  },
});
