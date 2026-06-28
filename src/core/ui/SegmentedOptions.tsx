import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {colors, radii, spacing} from '../../theme';
import {Text} from './Text';

export type SegmentedOption<T> = {label: string; value: T};

type SegmentedOptionsProps<T> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Equal-width single-select row (e.g. the 5 / 10 / 15 / 20 question-count
 * picker). Selected cell takes the accent; the rest sit on `surface`.
 */
export function SegmentedOptions<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedOptionsProps<T>) {
  return (
    <View style={styles.row}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{selected}}
            onPress={() => onChange(option.value)}
            style={({pressed}) => [
              styles.cell,
              selected ? styles.cellSelected : styles.cellIdle,
              pressed && styles.pressed,
            ]}>
            <Text
              variant="body"
              color={selected ? 'textPrimary' : 'textSecondary'}
              style={selected ? styles.labelSelected : undefined}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
    height: 64,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    backgroundColor: colors.primary,
  },
  cellIdle: {
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
  labelSelected: {
    fontWeight: '500',
  },
});
