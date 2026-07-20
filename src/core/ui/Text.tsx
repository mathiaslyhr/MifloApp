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

/**
 * The opt-in tight cap for text living in a FIXED-GEOMETRY board — the Hattrick
 * grid's axis and cell labels, the Team sheet's pitch tokens. These sit in
 * layouts sized to fit a 3x3 grid or eleven formation tokens across the screen,
 * so they cannot grow with Dynamic Type without overflowing the board itself.
 * Everything else in the app should use the generous default instead.
 */
export const BOARD_TEXT_SCALE = 1.15;

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
  maxFontSizeMultiplier,
  ...rest
}: Props) {
  const colors = useColors();
  return (
    <RNText
      /**
       * Dynamic Type. The default used to be a flat 1.2 on EVERY string in the
       * app, which is backwards: the layouts that actually break under growth
       * are a handful of fixed grids (the Hattrick board, the Team sheet
       * pitch), and capping those was paid for by capping all the body copy
       * too — on a trivia app where reading names IS the game.
       *
       * So the default is now generous, and the tight cap is opt-in: pass
       * `maxFontSizeMultiplier` explicitly on the cells that genuinely can't
       * flex. "Everything scales except what can't" beats "nothing scales".
       */
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? 1.5}
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
