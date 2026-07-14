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
 * An iOS-style grouped list card: an optional eyebrow
 * label above a surface card that wraps `MenuRow`s with hairline dividers
 * between them. The final child gets `isLast` injected so its divider drops.
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
    // Surface-1 card + the standard hairline (design.md); flat, no lift.
    card: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.divider,
      overflow: 'hidden',
    },
  });
