/**
 * Color tokens — Skin 1, the dark elevation-by-brightness system.
 * Spec: `docs/design.md`.
 *
 * Three rules govern every value here:
 *   1. Elevation is brightness, not shadow (closer to the user = lighter).
 *   2. Borders are always lighter than their surface, never darker.
 *   3. Never skip a step on the elevation ladder (background → surface →
 *      surface2 → divider).
 *
 * Screens read the palette through `useColors()` / `useThemedStyles()`, never
 * by hardcoding hex. `colors` re-exports it for the few static call sites left.
 */

/** The token shape the palette implements. */
export type Palette = {
  /** The screen itself. The zero point everything else is measured from. */
  background: string;
  /** Surface-1: answer options, leaderboard/question cards, input fields. */
  surface: string;
  /** Surface-2: bottom sheets, dropdowns, tooltips, timer pill, lifted cards. */
  surface2: string;
  /** Inset fills. Skin 1 has no darker-than-surface wells: inputs ARE surface-1. */
  surfaceSunken: string;

  /** The strongest neutral — headlines, icons, stat values (near-white on
   * dark). NOT the brand: solid brand fills read `primary`. */
  ink: string;
  /** Text/icon on top of a solid brand (`primary`) fill. */
  onInk: string;

  /** The three text levels. */
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Low-emphasis meta / captions (same level as textTertiary). */
  muted: string;

  /** The standard hairline: card edges AND dividers inside cards (never darker
   * than the card's own edge). */
  divider: string;

  /** Brand: primary button, progress fill, selected answer, active tab, and
   * the border on anything active/selected + secondary buttons. */
  primary: string;
  /** One step lighter, for small accent text that must read on dark. */
  primaryInk: string;

  /** Hairline rim on the solid (primary) button. */
  solidRim: string;

  /** Shadow — floating chrome ONLY; cards and buttons never carry shadow. */
  shadow: string;
  /** The shadow ink behind every lift — pair with a per-recipe `shadowOpacity`. */
  shadowInk: string;

  /** Modal scrims — dark dim for reveal overlays, lighter dim for picker sheets. */
  scrim: string;
  scrimLight: string;

  /** Scout guess-tile fills (DRAFT — see design.md, awaiting device sign-off). */
  guessHit: string;
  guessNear: string;
  guessMiss: string;

  /** Functional status (gameplay). DRAFT like the guess tiles. */
  success: string;
  error: string;
  /** Informational accent (neutral toasts). */
  info: string;

  /** Toast icon-chip fills. */
  toastTintNeutral: string;
  toastTintSuccess: string;
  toastTintError: string;

  /** 5-stop countdown ring: green → light green → yellow → orange → red. */
  timer: readonly [string, string, string, string, string];

  transparent: string;
};

/** Skin 1. The values mirror docs/design.md §2 exactly. */
export const skin1: Palette = {
  background: '#121212',
  surface: '#1A1A1A',
  surface2: '#222222',
  surfaceSunken: '#1A1A1A',

  ink: '#F5F5F5',
  onInk: '#F5F5F5',

  textPrimary: '#F5F5F5',
  textSecondary: '#A3A3A3',
  textTertiary: '#6E6E6E',
  muted: '#6E6E6E',

  divider: '#262626',

  primary: '#6260FF',
  primaryInk: '#8583FF',

  solidRim: 'rgba(255,255,255,0.18)',

  shadow: 'rgba(0,0,0,0.45)',
  shadowInk: '#000000',

  scrim: 'rgba(0,0,0,0.60)',
  scrimLight: 'rgba(0,0,0,0.35)',

  guessHit: '#4FB477',
  guessNear: '#E0A94A',
  guessMiss: '#3A3A3A',

  success: '#3FD07C',
  error: '#FF6A61',
  info: '#5B9CFF',

  toastTintNeutral: '#16233B',
  toastTintSuccess: '#173325',
  toastTintError: '#3A1F1E',

  timer: ['#3FD07C', '#7ED99A', '#F5C451', '#F2913D', '#FF6A61'],

  transparent: 'transparent',
};

/**
 * The palette under the legacy name. New code should prefer `useColors()` so it
 * reacts to skin changes; this alias keeps the few static call sites compiling.
 */
export const colors = skin1;

export type ColorToken = keyof Palette;
