import React from 'react';
import {Text as RNText, TextProps as RNTextProps, TextStyle} from 'react-native';
import {type as typeScale, TypeVariant, useColors, type Palette} from '../../theme';

type ColorName =
  | 'primary' // textPrimary ink
  | 'secondary'
  | 'tertiary'
  | 'muted'
  | 'onInk'
  | 'accent';

const colorFor = (c: Palette): Record<ColorName, string> => ({
  primary: c.textPrimary,
  secondary: c.textSecondary,
  tertiary: c.textTertiary,
  muted: c.muted,
  onInk: c.onInk,
  accent: c.primary,
});

type Props = RNTextProps & {
  /** Type-scale variant (defaults to `body`). */
  variant?: TypeVariant;
  /** Semantic text color (defaults to `primary` ink). */
  color?: ColorName;
  /** Convenience alignment. */
  align?: TextStyle['textAlign'];
};

/**
 * Themed text. Applies a Satoshi type-scale variant + a color token so screens
 * never hand-roll `fontFamily`/`fontSize`/hex.
 */
export function Text({
  variant = 'body',
  color = 'primary',
  align,
  style,
  ...rest
}: Props) {
  const colors = useColors();
  return (
    <RNText
      // Cap Dynamic Type: past ~1.2x the tight layouts clip instead of helping.
      maxFontSizeMultiplier={1.2}
      style={[
        typeScale[variant],
        {color: colorFor(colors)[color]},
        align ? {textAlign: align} : null,
        style,
      ]}
      {...rest}
    />
  );
}
