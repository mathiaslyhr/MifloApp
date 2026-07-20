/**
 * Design tokens barrel — the single import surface for the theme.
 * `import {colors, radii, spacing, type} from '../theme';`
 */
export {colors, skin1} from './colors';
export type {ColorToken, Palette} from './colors';
export {SKINS} from './skins';
export type {Skin, SkinId, Appearance} from './skins';
export {
  SkinProvider,
  useSkin,
  useColors,
  useThemedStyles,
} from './SkinProvider';
export {onRim} from './geometry';
export {radii} from './radii';
export type {RadiusToken} from './radii';
export {shadows} from './shadows';
export type {ShadowToken} from './shadows';
export {spacing, screenPadding, minTapTarget} from './spacing';
export type {SpacingToken} from './spacing';
export {fonts, type} from './typography';
export type {TypeVariant} from './typography';
export {motion} from './motion';
