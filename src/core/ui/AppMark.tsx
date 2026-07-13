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
const STROKE = 92;

// Tight bounding box of the art (stroke caps + ball included): x 266..752,
// y 314..720 → width 486, height 406.
const VB = {x: 266, y: 314, w: 486, h: 406};

export function AppMark({
  size = 28,
  color,
  ballColor,
}: {
  /** Rendered height in px; width follows the mark's aspect ratio. */
  size?: number;
  /** Override the `m` color (defaults to the theme's primary text / white). */
  color?: string;
  /** Override the ball color (defaults to the accent purple). */
  ballColor?: string;
}): React.JSX.Element {
  const colors = useColors();
  const stroke = color ?? colors.textPrimary;
  const ball = ballColor ?? colors.primary;
  const width = (size * VB.w) / VB.h;
  return (
    <Svg
      width={width}
      height={size}
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      accessibilityRole="image">
      <Path
        d={M_LEFT}
        stroke={stroke}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d={M_RIGHT}
        stroke={stroke}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={696} cy={664} r={56} fill={ball} />
    </Svg>
  );
}
