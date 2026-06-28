import type {TextStyle} from 'react-native';

/**
 * Satoshi is the primary typeface. We bundle the font files (see
 * assets/fonts + react-native.config.js). If they are missing, iOS falls
 * back to the system font automatically, so the app still renders.
 *
 * Two weights only: 400 (regular) and 500 (medium).
 */
export const fontFamily = {
  regular: 'Satoshi-Regular',
  medium: 'Satoshi-Medium',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
} as const;

/**
 * Type scale: 28 title / 20 section / 17 body / 15 secondary / 13 caption.
 * Each variant pairs a size with its default family + weight so callers
 * don't re-specify them.
 */
export const typography = {
  title: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 28,
    lineHeight: 34,
  },
  section: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 20,
    lineHeight: 26,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  secondary: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 13,
    lineHeight: 18,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
