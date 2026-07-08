/**
 * Typography (design.md §2). Typeface **Satoshi** — only Regular (400) and
 * Medium (500) are bundled; never bold, emphasis comes from size/color.
 *
 * `fontFamily` uses the fonts' iOS PostScript names (verified from the .otf):
 * `Satoshi-Regular` / `Satoshi-Medium`. RN resolves these on both platforms.
 */
export const fonts = {
  regular: 'Satoshi-Regular',
  medium: 'Satoshi-Medium',
} as const;

type Variant = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

/**
 * The type scale. Kept deliberately **thin** to match the website — big headers
 * use Satoshi **Regular** (not Medium/bold) for the airy look; Medium is reserved
 * for small UI labels/wordmark where a little weight aids legibility.
 *
 * Standard sizes (per the design direction): header 32, body 16, small 14.
 */
export const type = {
  /** Oversized landing hero. Thin. */
  hero: {fontFamily: fonts.regular, fontSize: 40, lineHeight: 46, letterSpacing: -0.6},
  /** Screen header — the standard 32px title. Thin. */
  title: {fontFamily: fonts.regular, fontSize: 32, lineHeight: 38, letterSpacing: -0.5},
  /** Section headings. Thin. */
  section: {fontFamily: fonts.regular, fontSize: 17, lineHeight: 22, letterSpacing: -0.2},
  /** The "Miflo" top-bar wordmark. */
  wordmark: {fontFamily: fonts.medium, fontSize: 20, lineHeight: 24, letterSpacing: -0.3},
  /** Body copy — 16px. */
  body: {fontFamily: fonts.regular, fontSize: 16, lineHeight: 24},
  /** Secondary / smaller body — 14px. */
  secondary: {fontFamily: fonts.regular, fontSize: 14, lineHeight: 20},
  /** Button / control labels — 15px, a touch of weight. */
  label: {fontFamily: fonts.medium, fontSize: 15, lineHeight: 19},
  /** Captions / meta — 12px. */
  caption: {fontFamily: fonts.regular, fontSize: 12, lineHeight: 16},
} as const satisfies Record<string, Variant>;

export type TypeVariant = keyof typeof type;
