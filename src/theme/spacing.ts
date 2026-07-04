/**
 * 4px spacing rhythm. Use the named steps (or `space(n)` for one-offs) instead
 * of raw numbers so vertical/horizontal cadence stays consistent across screens.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 56,
} as const;

/** Arbitrary multiple of the 4px base. */
export const space = (n: number): number => n * 4;

/** Default screen side padding. */
export const screenPadding = 16;

/** Minimum comfortable touch target (a11y). */
export const minTapTarget = 44;

export type SpacingToken = keyof typeof spacing;
