import React from 'react';
import {Text as RNText, TextProps as RNTextProps, TextStyle} from 'react-native';
import {colors, type as typeScale, TypeVariant} from '../../theme';

type ColorName =
  | 'primary' // textPrimary ink
  | 'secondary'
  | 'tertiary'
  | 'muted'
  | 'onInk'
  | 'accent';

const COLOR_MAP: Record<ColorName, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  muted: colors.muted,
  onInk: colors.onInk,
  accent: colors.primary,
};

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
  return (
    <RNText
      style={[
        typeScale[variant],
        {color: COLOR_MAP[color]},
        align ? {textAlign: align} : null,
        style,
      ]}
      {...rest}
    />
  );
}
