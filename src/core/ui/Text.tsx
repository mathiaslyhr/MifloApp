import React from 'react';
import {Text as RNText, StyleSheet, type TextProps} from 'react-native';
import {colors, typography, type TypographyVariant, type ColorToken} from '../../theme';

type AppTextProps = TextProps & {
  /** Type-scale variant. Defaults to `body`. */
  variant?: TypographyVariant;
  /** Color token. Defaults to `textPrimary`. */
  color?: ColorToken;
  /** Center the text horizontally. */
  center?: boolean;
};

/**
 * The only text component in the app. Pulls size/weight from the type scale
 * and color from tokens — no raw font or hex values at the call site.
 */
export function Text({
  variant = 'body',
  color = 'textPrimary',
  center,
  style,
  ...rest
}: AppTextProps) {
  return (
    <RNText
      style={[
        typography[variant],
        {color: colors[color]},
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: {textAlign: 'center'},
});
