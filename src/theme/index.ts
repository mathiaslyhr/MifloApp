/**
 * Centralized design tokens for Miflo. Import everything theme-related from
 * here so components never reach for raw values.
 *
 *   import {colors, spacing, typography, radii} from '../theme';
 */
export {colors} from './colors';
export type {ColorToken} from './colors';

export {typography, fontFamily, fontWeight} from './typography';
export type {TypographyVariant} from './typography';

export {spacing, screenPadding, minTapTarget} from './spacing';
export type {SpacingToken} from './spacing';

export {radii} from './radii';
export type {RadiusToken} from './radii';

import {colors} from './colors';
import {typography, fontFamily, fontWeight} from './typography';
import {spacing, screenPadding, minTapTarget} from './spacing';
import {radii} from './radii';

/** Single aggregate token object, handy for prop drilling or theming libs. */
export const theme = {
  colors,
  typography,
  fontFamily,
  fontWeight,
  spacing,
  screenPadding,
  minTapTarget,
  radii,
} as const;

export type Theme = typeof theme;
