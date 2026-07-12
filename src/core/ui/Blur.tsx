import React from 'react';
import {StyleProp, StyleSheet, ViewStyle} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useSkin} from '../../theme';

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
 * the content beneath the bar blurs through it. The blur tint follows the active
 * appearance (`light`/`dark`); it falls back to the near-solid frosted
 * `glassStrong` of that palette when the user enables Reduce Transparency.
 */
export function AppBlur({amount = 18, style}: Props) {
  const {skin, colors} = useSkin();
  return (
    <BlurView
      style={[StyleSheet.absoluteFill, style]}
      blurType={skin.appearance === 'dark' ? 'dark' : 'light'}
      blurAmount={amount}
      reducedTransparencyFallbackColor={colors.glassStrong}
      pointerEvents="none"
    />
  );
}
