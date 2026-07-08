import React from 'react';
import {StyleProp, StyleSheet, ViewStyle} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {colors} from '../../theme';

type Props = {
  /**
   * Blur intensity (iOS `blurAmount`). Chrome bars use ~18; the nav pill a touch
   * more so scrolling content reads as clearly frosted.
   */
  amount?: number;
  /** Extra style (defaults to filling the parent). */
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's single backdrop-blur surface — a thin wrapper over
 * `@react-native-community/blur` so every frosted chrome element (bottom nav,
 * pinned headers, status strip) shares one integration point. Swap the
 * underlying library here and nothing else changes.
 *
 * Renders as an absolute fill by default, so drop it behind a bar's content and
 * the content beneath the bar blurs through it. Light palette → `light` blur;
 * falls back to a near-solid frosted white when the user enables Reduce
 * Transparency.
 */
export function AppBlur({amount = 18, style}: Props) {
  return (
    <BlurView
      style={[StyleSheet.absoluteFill, style]}
      blurType="light"
      blurAmount={amount}
      reducedTransparencyFallbackColor={colors.glassStrong}
      pointerEvents="none"
    />
  );
}
