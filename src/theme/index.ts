/**
 * Design tokens barrel — the single import surface for the theme.
 * `import {colors, radii, spacing, type} from '../theme';`
 */
export {colors, light, dark} from './colors';
export type {ColorToken, Palette} from './colors';
export {SKINS, SYSTEM_SKIN} from './skins';
export type {Skin, SkinId, Appearance, Mesh, Bloom} from './skins';
export {
  SkinProvider,
  useSkin,
  useColors,
  useThemedStyles,
} from './SkinProvider';
export {radii} from './radii';
export type {RadiusToken} from './radii';
export {shadows} from './shadows';
export type {ShadowToken} from './shadows';
export {spacing, space, screenPadding, minTapTarget} from './spacing';
export type {SpacingToken} from './spacing';
export {fonts, type} from './typography';
export type {TypeVariant} from './typography';
