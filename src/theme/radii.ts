/**
 * Corner radii. Cards 16, pills fully round (buttons are pills).
 */
export const radii = {
  card: 16,
  /** Fully round — pills, avatars, buttons, the nav island. */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;
