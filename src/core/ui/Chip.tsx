import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {colors, radii, spacing} from '../../theme';
import {Text} from './Text';
import {Icon} from './Icon';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

/**
 * Pill-shaped selectable filter (e.g. topics). Selected fills with the accent
 * and shows a leading check; idle sits on `surface` with a hairline border.
 */
export function Chip({label, selected, onPress}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected: !!selected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && styles.pressed,
      ]}>
      <View style={styles.inner} pointerEvents="none">
        {selected && <Icon name="check" size={16} color="textPrimary" />}
        <Text
          variant="body"
          color={selected ? 'textPrimary' : 'textSecondary'}
          style={selected ? styles.labelSelected : undefined}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selected: {
    backgroundColor: colors.primary,
  },
  idle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pressed: {
    opacity: 0.85,
  },
  labelSelected: {
    fontWeight: '500',
  },
});
