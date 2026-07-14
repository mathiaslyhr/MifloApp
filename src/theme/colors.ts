/**
 * Color tokens — the app's single palette.
 *
 * PLACEHOLDER NEUTRAL PALETTE. The visual design is being rebuilt from scratch;
 * until the new skin's colors land, everything renders in plain grayscale.
 * Paste the new skin's values into `neutral` below — this file is the one
 * place color lives.
 *
 * Screens read the palette through `useColors()` / `useThemedStyles()`, never
 * by hardcoding hex. `colors` re-exports it for the few static call sites left.
 */

/** The token shape the palette implements. */
export type Palette = {
  /** App background. */
  background: string;
  /** Solid card / gameplay ground. */
  surface: string;
  /** Muted fill for chips, inactive tabs, answer rows, fields. */
  surface2: string;
  /** Sunken/inset fill for input fields and icon wells. */
  surfaceSunken: string;

  /** The one near-black. Solid buttons, headings. */
  ink: string;
  /** Text/icon on top of `ink`. */
  onInk: string;

  /** Ink at descending opacity — the type ramp. */
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Low-emphasis meta / captions. */
  muted: string;

  /** Hairline dividers. */
  divider: string;

  /** Single brand color. */
  primary: string;
  primaryInk: string;

  /** Translucent chrome surfaces (blur pills, frosted headers). */
  glass: string;
  glassLight: string;
  glassRim: string;
  /** Near-solid frosted surface — for cards floating on a dimmed scrim. */
  glassStrong: string;
  /** Hairline rim on the solid (primary) button. */
  solidRim: string;

  /** Ambient lift shadow color (used with elevation/offsets per component). */
  shadow: string;
  /** The shadow ink behind every lift — pair with a per-recipe `shadowOpacity`. */
  shadowInk: string;

  /** Modal scrims — dark dim for reveal overlays, lighter dim for picker sheets. */
  scrim: string;
  scrimLight: string;

  /** Scout guess-tile fills — bold Wordle tones carrying white `onInk` text. */
  guessHit: string;
  guessNear: string;
  guessMiss: string;

  /** Functional status (gameplay). */
  success: string;
  error: string;
  /** Informational accent (neutral toasts). */
  info: string;

  /** Toast icon-chip fills. */
  toastTintNeutral: string;
  toastTintSuccess: string;
  toastTintError: string;

  /** 5-stop countdown ring: dark green → light green → yellow → orange → red. */
  timer: readonly [string, string, string, string, string];

  transparent: string;
};

/**
 * The neutral grayscale placeholder. Structural tokens are deliberately
 * colorless (accents read as black) so the next skin starts from a blank
 * canvas. Functional tokens (guess tiles, status, toasts, timer) keep real
 * hues — they are semantically color-coded and unplayable in gray.
 */
export const neutral: Palette = {
  background: '#F4F4F4',
  surface: '#FFFFFF',
  surface2: '#ECECEC',
  surfaceSunken: '#E3E3E3',

  ink: '#111111',
  onInk: '#FFFFFF',

  textPrimary: '#111111',
  textSecondary: 'rgba(17,17,17,0.55)',
  textTertiary: 'rgba(17,17,17,0.40)',
  muted: '#6B6B6B',

  divider: 'rgba(17,17,17,0.12)',

  primary: '#111111',
  primaryInk: '#333333',

  glass: 'rgba(255,255,255,0.65)',
  glassLight: 'rgba(255,255,255,0.45)',
  glassRim: 'rgba(17,17,17,0.10)',
  glassStrong: 'rgba(255,255,255,0.92)',
  solidRim: 'rgba(255,255,255,0.20)',

  shadow: 'rgba(0,0,0,0.15)',
  shadowInk: '#000000',

  scrim: 'rgba(0,0,0,0.45)',
  scrimLight: 'rgba(0,0,0,0.15)',

  guessHit: '#4FB477',
  guessNear: '#E0A94A',
  guessMiss: '#9AA0A8',

  success: '#32C36C',
  error: '#F0544A',
  info: '#2F6FED',

  toastTintNeutral: '#E2ECFD',
  toastTintSuccess: '#DEF5E8',
  toastTintError: '#FDE4E2',

  timer: ['#32C36C', '#7ED99A', '#F5C451', '#F2913D', '#F0544A'],

  transparent: 'transparent',
};

/**
 * The palette under the legacy name. New code should prefer `useColors()` so it
 * reacts to skin changes; this alias keeps the few static call sites compiling.
 */
export const colors = neutral;

export type ColorToken = keyof Palette;
