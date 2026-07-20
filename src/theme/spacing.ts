/**
 * 4px spacing rhythm. Use the named steps instead of raw numbers so
 * vertical/horizontal cadence stays consistent across screens.
 *
 * The ladder skips 20 and 40 (lg 16 → xl 24, xxl 32 → xxxl 56), which is why a
 * handful of call sites carry `spacing.sm + 2` style arithmetic. Inserting the
 * missing rungs would mean renaming every step above them and re-checking ~490
 * call sites by eye, so the gaps stay for now; prefer the nearest step over a
 * raw number when you hit one.
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

/** Default screen side padding. */
export const screenPadding = 16;

/** Minimum comfortable touch target (a11y). */
export const minTapTarget = 44;

export type SpacingToken = keyof typeof spacing;
