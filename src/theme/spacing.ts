/**
 * Spacing scale: 4 / 8 / 12 / 16 / 24. Screen side padding 16–18.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Default horizontal padding for screen content. */
export const screenPadding = 16;

/** Minimum interactive tap target (Apple HIG). */
export const minTapTarget = 44;

export type SpacingToken = keyof typeof spacing;
