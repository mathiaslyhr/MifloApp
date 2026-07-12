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
 * Sizes/line-heights follow Apple's iOS Dynamic Type scale (weights kept thin).
 */
export const type = {
  /** Oversized landing hero. Thin. iOS Large Title metrics. */
  hero: {fontFamily: fonts.regular, fontSize: 34, lineHeight: 41, letterSpacing: -0.6},
  /** Screen header title. Thin. iOS Title 1 metrics. */
  title: {fontFamily: fonts.regular, fontSize: 28, lineHeight: 34, letterSpacing: -0.5},
  /** Section headings. Thin. iOS Headline/Body size. */
  section: {fontFamily: fonts.regular, fontSize: 17, lineHeight: 22, letterSpacing: -0.2},
  /** The "Miflo" top-bar wordmark. iOS Title 3 metrics. */
  wordmark: {fontFamily: fonts.medium, fontSize: 20, lineHeight: 25, letterSpacing: -0.3},
  /** Body copy. iOS Callout metrics. */
  body: {fontFamily: fonts.regular, fontSize: 16, lineHeight: 21},
  /** Secondary / smaller body. iOS Footnote metrics. */
  secondary: {fontFamily: fonts.regular, fontSize: 13, lineHeight: 18},
  /** Button / control labels — a touch of weight. iOS Subheadline size. */
  label: {fontFamily: fonts.medium, fontSize: 15, lineHeight: 20},
  /** Captions / meta. iOS Caption 1 metrics. */
  caption: {fontFamily: fonts.regular, fontSize: 12, lineHeight: 16},
} as const satisfies Record<string, Variant>;

export type TypeVariant = keyof typeof type;
