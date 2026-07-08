/**
 * Color tokens — the light rainbow/glass palette ported from the website
 * (`docs/design.md` §3, `globals.css @theme`). One near-black ink at varying
 * opacity, a single brand purple, translucent glass fills for the canvas chrome,
 * and functional status/timer colors for the gameplay screens.
 *
 * Screens must read from here — never hardcode hex.
 */
export const colors = {
  /** App background beneath the canvas (rarely visible on rainbow screens). */
  background: '#F5F3FB',
  /** Solid card / gameplay ground. */
  surface: '#FFFFFF',
  /** Muted fill for chips, inactive tabs, answer rows, fields. */
  surface2: '#F1EEFB',

  /** The one near-black. Solid buttons, headings, primary text. */
  ink: '#0D0D16',
  /** Text/icon on top of `ink`. */
  onInk: '#FFFFFF',

  /** Ink at descending opacity — the type ramp (design.md §2). */
  textPrimary: '#0D0D16',
  textSecondary: 'rgba(13,13,22,0.55)',
  textTertiary: 'rgba(13,13,22,0.45)',
  /** Low-emphasis meta / captions (app-mock `--color-muted`). */
  muted: '#5B5B6B',

  /** Hairline dividers. */
  divider: 'rgba(13,13,22,0.10)',

  /** Single brand color. */
  primary: '#6260F6',
  primaryInk: '#4A48D6',

  /** Glass surfaces on the rainbow canvas. */
  glass: 'rgba(255,255,255,0.55)',
  glassLight: 'rgba(255,255,255,0.40)',
  glassRim: 'rgba(255,255,255,0.65)',
  /** Near-solid frosted white — for cards floating on a dimmed (dark) scrim. */
  glassStrong: 'rgba(255,255,255,0.92)',
  /** Hairline white rim on the solid (primary) button. */
  solidRim: 'rgba(255,255,255,0.25)',

  /** Ambient lift shadow color (used with elevation/offsets per component). */
  shadow: 'rgba(20,15,50,0.18)',
  /**
   * The shadow ink behind every lift in the app — pair with a per-recipe
   * `shadowOpacity` (see `theme/shadows`). `shadow` above is this same hue
   * pre-multiplied to 0.18 for call sites that keep `shadowOpacity: 1`.
   */
  shadowInk: '#140F32',

  /** Modal scrims — dark dim for reveal overlays, light dim for picker/help sheets. */
  scrim: 'rgba(13,13,22,0.45)',
  scrimLight: 'rgba(13,13,22,0.15)',

  /** Scout guess-tile fills — bold Wordle tones carrying white `onInk` text. */
  guessHit: '#4FB477',
  guessNear: '#E0A94A',
  guessMiss: '#9AA0A8',

  /** Functional status (gameplay). */
  success: '#32C36C',
  error: '#F0544A',

  /** 5-stop countdown ring: dark green → light green → yellow → orange → red. */
  timer: ['#32C36C', '#7ED99A', '#F5C451', '#F2913D', '#F0544A'] as const,

  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
