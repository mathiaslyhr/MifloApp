import {colors} from './colors';

/**
 * The two ambient lift recipes shared across the glass chrome. Spread into
 * `StyleSheet.create` entries (`{...shadows.soft}`). Lifts belong ONLY to
 * elements that truly float above other content (nav island, pinned circle
 * buttons, sheets over a scrim, toasts); in-flow glass and the black button
 * are flat. Components with a bespoke lift (sheets) keep their own numbers
 * and only share `colors.shadowInk`.
 */
export const shadows = {
  /** Soft glass lift — circle buttons, tiles, and chips resting on the canvas. */
  soft: {
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 4,
  },
  /** Floating island lift — the nav pill, grouped menu cards, the lobby code pill. */
  floating: {
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.18,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export type ShadowToken = keyof typeof shadows;
