/**
 * AppMark — the "m." brand mark from the app icon, as an inline SVG so it stays
 * crisp at any size and follows the theme (white `m` + purple ball). The
 * geometry mirrors the app icon (rounded lowercase `m` whose right leg is only
 * the top half, with the purple ball as its terminal below).
 *
 * Drawn on a 1024 grid (legs x=312/504/696, arches spring at y=456, hump r=96,
 * baseline y=664), then framed with a tight viewBox so the mark fills `size`
 * (its height) with no dead padding — the round caps supply the optical margin.
 */
import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';
import {useColors} from '../../theme';

// Left half (stem + first hump + middle leg) and right half (second hump + the
// half-height right leg), stroked with round caps/joins.
const M_LEFT = 'M 312 664 L 312 456 A 96 96 0 0 1 504 456 L 504 664';
const M_RIGHT = 'M 504 456 A 96 96 0 0 1 696 456 L 696 532';
/** The icon/logo limb thickness (1024-grid units). */
const LOGO_STROKE = 92;

export function AppMark({
  size = 28,
  color,
  ballColor,
  stroke: strokeWidth = LOGO_STROKE,
}: {
  /** Rendered height in px; width follows the mark's aspect ratio. */
  size?: number;
  /** Override the `m` color (defaults to the theme's primary text / white). */
  color?: string;
  /** Override the ball color (defaults to the accent purple). */
  ballColor?: string;
  /** Limb thickness in 1024-grid units. Default is the logo weight (92); the
   * welcome wordmark thins it to match Satoshi's stroke so the mark reads as
   * a letter of the word (the FotMob trick). */
  stroke?: number;
}): React.JSX.Element {
  const colors = useColors();
  const stroke = color ?? colors.textPrimary;
  const ball = ballColor ?? colors.primary;
  // Tight bounding box of the art: stroke caps left/top, the ball (r 56 at
  // 696,664) fixes the right/bottom edges for any stroke thinner than it.
  const vb = {
    x: 312 - strokeWidth / 2,
    y: 360 - strokeWidth / 2,
  };
  const vbW = Math.max(696 + strokeWidth / 2, 752) - vb.x;
  const vbH = Math.max(664 + strokeWidth / 2, 720) - vb.y;
  const width = (size * vbW) / vbH;
  return (
    <Svg
      width={width}
      height={size}
      viewBox={`${vb.x} ${vb.y} ${vbW} ${vbH}`}
      accessibilityRole="image">
      <Path
        d={M_LEFT}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d={M_RIGHT}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={696} cy={664} r={56} fill={ball} />
    </Svg>
  );
}
