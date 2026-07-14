import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {LucideIcon} from 'lucide-react-native';
import {
  radii,
  spacing,
  type as typeScale,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {Text} from './Text';
import {PressableScale} from './PressableScale';
import {haptics} from '../haptics';

export type SegmentedOption<K extends string> = {
  key: K;
  label: string;
  /** Optional leading glyph, tinted to match the segment's text colour. */
  Icon?: LucideIcon;
};

/**
 * A two-plus-option in-page segmented toggle (e.g. Friendlies | Competitive):
 * a `surface2` track holding equal-width segments; the selected one fills brand
 * purple with `onInk` text, the rest read as `textSecondary`. Each segment
 * shares the springy press-scale. No frost.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.track}>
      {options.map(opt => {
        const selected = opt.key === value;
        const tint = selected ? colors.onInk : colors.textSecondary;
        return (
          <PressableScale
            key={opt.key}
            containerStyle={styles.segmentContainer}
            accessibilityRole="button"
            accessibilityState={{selected}}
            accessibilityLabel={opt.label}
            onPress={() => {
              if (!selected) {
                haptics.tap();
                onChange(opt.key);
              }
            }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            {opt.Icon ? <opt.Icon size={16} color={tint} strokeWidth={2} /> : null}
            <Text style={[styles.label, {color: tint}]}>{opt.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: c.surface2,
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
      padding: 4,
      gap: 4,
    },
    segmentContainer: {flex: 1},
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 10,
      borderRadius: radii.pill,
    },
    segmentSelected: {backgroundColor: c.primary},
    label: {...typeScale.label},
  });
