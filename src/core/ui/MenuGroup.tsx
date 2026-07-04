import React from 'react';
import {StyleSheet, View} from 'react-native';
import {colors, radii, spacing} from '../../theme';
import {Text} from './Text';

type Props = {
  /** Optional eyebrow label above the card (e.g. "ACCOUNT"). */
  label?: string;
  /** `MenuRow` children — the last one's divider is dropped automatically. */
  children: React.ReactNode;
};

/**
 * An iOS-style grouped list card on the rainbow canvas: an optional eyebrow
 * label above a glass card that wraps `MenuRow`s with hairline dividers between
 * them. The final child gets `isLast` injected so its divider is dropped.
 */
export function MenuGroup({label, children}: Props) {
  const items = React.Children.toArray(children);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" color="tertiary" style={styles.eyebrow}>
          {label.toUpperCase()}
        </Text>
      ) : null}
      <View style={styles.card}>
        {items.map((child, i) =>
          React.isValidElement(child)
            ? React.cloneElement(child, {
                isLast: i === items.length - 1,
              } as {isLast: boolean})
            : child,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: spacing.sm},
  eyebrow: {
    letterSpacing: 1,
    marginLeft: spacing.md,
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.glassRim,
    overflow: 'hidden',
    shadowColor: '#140F32',
    shadowOpacity: 0.18,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 24,
    elevation: 8,
  },
});
