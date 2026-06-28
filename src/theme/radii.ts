/**
 * Corner radii: cards 16, buttons 14, chips/pills full.
 */
export const radii = {
  card: 16,
  button: 14,
  pill: 999, // full / chips
} as const;

export type RadiusToken = keyof typeof radii;
