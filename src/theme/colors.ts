/**
 * Color tokens — the rainbow/glass palette ported from the website
 * (`docs/design.md` §3, `globals.css @theme`). One near-black ink at varying
 * opacity, a single brand purple, translucent glass fills for the canvas chrome,
 * and functional status/timer colors for the gameplay screens.
 *
 * Two palettes share one shape (`Palette`): `light` (the original) and `dark`.
 * The active palette is chosen at runtime by the SkinProvider — screens read it
 * through `useColors()` / `useThemedStyles()`, never by hardcoding hex.
 *
 * `colors` re-exports the light palette so pre-migration call sites that still do
 * `import {colors}` keep compiling (and stay light) until they move to the hook.
 */

/** The token shape both palettes implement. */
export type Palette = {
  /** App background beneath the canvas (rarely visible on rainbow screens). */
  background: string;
  /** Solid card / gameplay ground. */
  surface: string;
  /** Muted fill for chips, inactive tabs, answer rows, fields. */
  surface2: string;

  /** The one near-black (light) / near-white (dark). Solid buttons, headings. */
  ink: string;
  /** Text/icon on top of `ink`. */
  onInk: string;

  /** Ink at descending opacity — the type ramp (design.md §2). */
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Low-emphasis meta / captions (app-mock `--color-muted`). */
  muted: string;

  /** Hairline dividers. */
  divider: string;

  /** Single brand color. */
  primary: string;
  primaryInk: string;

  /** Glass surfaces on the rainbow canvas. */
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

  /** Toast icon-chip fills. */
  toastTintNeutral: string;
  toastTintSuccess: string;
  toastTintError: string;

  /** 5-stop countdown ring: dark green → light green → yellow → orange → red. */
  timer: readonly [string, string, string, string, string];

  transparent: string;
};

/** The original light rainbow/glass palette. */
export const light: Palette = {
  background: '#F5F3FB',
  surface: '#FFFFFF',
  surface2: '#F1EEFB',

  ink: '#0D0D16',
  onInk: '#FFFFFF',

  textPrimary: '#0D0D16',
  textSecondary: 'rgba(13,13,22,0.55)',
  textTertiary: 'rgba(13,13,22,0.45)',
  muted: '#5B5B6B',

  divider: 'rgba(13,13,22,0.10)',

  primary: '#6260F6',
  primaryInk: '#4A48D6',

  glass: 'rgba(255,255,255,0.55)',
  glassLight: 'rgba(255,255,255,0.40)',
  glassRim: 'rgba(255,255,255,0.65)',
  glassStrong: 'rgba(255,255,255,0.92)',
  solidRim: 'rgba(255,255,255,0.25)',

  shadow: 'rgba(20,15,50,0.18)',
  shadowInk: '#140F32',

  scrim: 'rgba(13,13,22,0.45)',
  scrimLight: 'rgba(13,13,22,0.15)',

  guessHit: '#4FB477',
  guessNear: '#E0A94A',
  guessMiss: '#9AA0A8',

  success: '#32C36C',
  error: '#F0544A',

  toastTintNeutral: '#E6E6FE',
  toastTintSuccess: '#DEF5E8',
  toastTintError: '#FDE4E2',

  timer: ['#32C36C', '#7ED99A', '#F5C451', '#F2913D', '#F0544A'],

  transparent: 'transparent',
};

/**
 * The dark palette — same "glass on rainbow" idea inverted onto a near-black
 * base. Draft values; the dark aesthetic (and the dark mesh) is tuned and
 * signed off via the Phase 2 mockup before any screen renders it.
 *
 * Ink flips to near-white; glass fills become faint white translucency over a
 * dark canvas (so blur shows through) with soft light rims; scrims deepen.
 * Functional status/timer/guess tones stay vivid — they read fine on dark and
 * are semantically fixed — but `surface`/`surface2` grounds go dark.
 */
export const dark: Palette = {
  background: '#0B0B12',
  surface: '#17171F',
  surface2: '#20202B',

  ink: '#F4F3FA',
  onInk: '#0D0D16',

  textPrimary: '#F4F3FA',
  textSecondary: 'rgba(244,243,250,0.60)',
  textTertiary: 'rgba(244,243,250,0.45)',
  muted: '#9A9AAB',

  divider: 'rgba(244,243,250,0.12)',

  primary: '#8280FF',
  primaryInk: '#A6A4FF',

  glass: 'rgba(255,255,255,0.10)',
  glassLight: 'rgba(255,255,255,0.06)',
  glassRim: 'rgba(255,255,255,0.16)',
  glassStrong: 'rgba(30,30,42,0.92)',
  solidRim: 'rgba(255,255,255,0.14)',

  shadow: 'rgba(0,0,0,0.45)',
  shadowInk: '#000000',

  scrim: 'rgba(0,0,0,0.60)',
  scrimLight: 'rgba(0,0,0,0.35)',

  guessHit: '#4FB477',
  guessNear: '#E0A94A',
  guessMiss: '#5B616B',

  success: '#3FD07C',
  error: '#FF6A61',

  toastTintNeutral: '#26263A',
  toastTintSuccess: '#173325',
  toastTintError: '#3A1F1E',

  timer: ['#3FD07C', '#7ED99A', '#F5C451', '#F2913D', '#FF6A61'],

  transparent: 'transparent',
};

/**
 * Skin 3's palette — the new default look, built page by page. Starts as a copy
 * of `dark` (a blank canvas) and gets repainted token by token as each screen is
 * rebuilt onto the new aesthetic. Nothing final is committed here yet.
 */
export const skin3: Palette = {...dark};

/**
 * The light palette under the legacy name. New code should prefer `useColors()`
 * so it reacts to the active theme; this alias keeps un-migrated modules
 * (`import {colors}`) compiling and rendering light.
 */
export const colors = light;

export type ColorToken = keyof Palette;
