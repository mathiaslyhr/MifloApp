import React from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * The static rainbow canvas — the app's chrome background, ported from the
 * website's `HOME_BASE` wash + `RAINBOW` blooms (docs/design.md §4,
 * Miflo/src/components/glass/MeshGradient.tsx).
 *
 * There's no CSS blur in RN, so the soft blooms are oversized SVG ellipses with
 * a radial core→transparent fade (objectBoundingBox → the fade is elliptical).
 * Static (no animation) for best FPS/battery and free reduced-motion support.
 *
 * Rendered absolute-fill behind screen content by `<Screen canvas>`.
 */

/** 8-stop vertical wash (position 0–1, color). */
const BASE_STOPS: {offset: number; color: string}[] = [
  {offset: 0, color: '#fdf2f7'}, // pink
  {offset: 0.15, color: '#f7e5ef'}, // rose
  {offset: 0.3, color: '#ece6f8'}, // purple
  {offset: 0.44, color: '#e1e7f7'}, // dark blue
  {offset: 0.57, color: '#e6f1fb'}, // light blue
  {offset: 0.7, color: '#e2f3ea'}, // green
  {offset: 0.84, color: '#f1f2d8'}, // yellow
  {offset: 1, color: '#f9e8d2'}, // orange
];

/** 7 blooms: rgb core, alpha, vertical center %, and which side the core sits. */
const BLOOMS: {
  rgb: string;
  alpha: number;
  cy: number; // 0–1 down the canvas
  side: 'left' | 'right';
}[] = [
  {rgb: '240,150,190', alpha: 0.26, cy: 0.03, side: 'left'}, // pink
  {rgb: '150,148,240', alpha: 0.22, cy: 0.2, side: 'right'}, // purple
  {rgb: '88,142,228', alpha: 0.26, cy: 0.35, side: 'left'}, // dark blue
  {rgb: '150,200,245', alpha: 0.24, cy: 0.5, side: 'right'}, // light blue
  {rgb: '90,206,168', alpha: 0.26, cy: 0.66, side: 'left'}, // green
  {rgb: '244,220,140', alpha: 0.26, cy: 0.82, side: 'right'}, // yellow
  {rgb: '246,184,132', alpha: 0.28, cy: 0.94, side: 'left'}, // orange
];

export function MeshBackground() {
  const {width, height} = useWindowDimensions();
  // Oversize so only the soft cores show; overscan the height a touch.
  const h = height * 1.05;
  const rx = width * 0.85;
  const ry = h * 0.3;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="base" x1="0" y1="0" x2="0" y2={h}>
            {BASE_STOPS.map(s => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
          {BLOOMS.map((b, i) => (
            <RadialGradient key={i} id={`bloom${i}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={`rgb(${b.rgb})`} stopOpacity={b.alpha} />
              <Stop offset="1" stopColor={`rgb(${b.rgb})`} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        <Rect x="0" y="0" width={width} height={h} fill="url(#base)" />

        {BLOOMS.map((b, i) => (
          <Ellipse
            key={i}
            cx={b.side === 'left' ? width * 0.25 : width * 0.75}
            cy={h * b.cy}
            rx={rx}
            ry={ry}
            fill={`url(#bloom${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}
