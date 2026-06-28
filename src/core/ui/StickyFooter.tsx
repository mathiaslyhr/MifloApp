import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {spacing} from '../../theme';

type StickyFooterProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Pins its children (typically the primary CTA) to the bottom of a `Screen`.
 * Place as the last child of `Screen` after a `flex: 1` content area; the
 * Screen's safe-area inset handles the home indicator gap below.
 */
export function StickyFooter({children, style}: StickyFooterProps) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  footer: {
    paddingTop: spacing.lg,
  },
});
