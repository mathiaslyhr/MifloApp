/**
 * Corner radii (design.md §10). Cards 16, buttons 14, pills fully round.
 */
export const radii = {
  card: 16,
  button: 14,
  /** Fully round — pills, avatars, the nav island. */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;
