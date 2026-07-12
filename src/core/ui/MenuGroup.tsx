import React from 'react';
import {StyleSheet, View} from 'react-native';
import {radii, spacing, useThemedStyles, type Palette} from '../../theme';
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
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {gap: spacing.sm},
    eyebrow: {
      letterSpacing: 1,
      marginLeft: spacing.md,
    },
    card: {
      backgroundColor: c.glass,
      borderRadius: radii.card,
      borderWidth: 1,
      // Flat like all in-flow glass. (A lift here never rendered on iOS anyway:
      // overflow:'hidden' clips the view's own shadow.)
      borderColor: c.glassRim,
      overflow: 'hidden',
    },
  });
