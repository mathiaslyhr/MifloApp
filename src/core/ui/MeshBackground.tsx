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
import {useSkin} from '../../theme';

/**
 * The rainbow canvas — the app's chrome background, ported from the website's
 * `HOME_BASE` wash + `RAINBOW` blooms (docs/design.md §4).
 *
 * There's no CSS blur in RN, so the soft blooms are oversized SVG ellipses with
 * a radial core→transparent fade (objectBoundingBox → the fade is elliptical).
 * Static (no animation) for best FPS/battery and free reduced-motion support.
 *
 * The stops + blooms come from the active skin's `mesh`, so each skin brings its
 * own canvas (light "Daylight" pastel wash, dark "Aurora" fields) and a new skin
 * just adds its mesh to the registry.
 *
 * Rendered absolute-fill behind screen content by `<Screen canvas>`.
 */
export function MeshBackground() {
  const {width, height} = useWindowDimensions();
  const {skin} = useSkin();
  const mesh = skin.mesh;

  // Oversize so only the soft cores show; overscan the height a touch.
  const h = height * 1.05;
  const rx = width * 0.85;
  const ry = h * 0.3;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="base" x1="0" y1="0" x2="0" y2={h}>
            {mesh.base.map(s => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
          {mesh.blooms.map((b, i) => (
            <RadialGradient key={i} id={`bloom${i}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={`rgb(${b.rgb})`} stopOpacity={b.alpha} />
              <Stop offset="1" stopColor={`rgb(${b.rgb})`} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        <Rect x="0" y="0" width={width} height={h} fill="url(#base)" />

        {mesh.blooms.map((b, i) => (
          <Ellipse
            key={i}
            cx={width * b.cx}
            cy={h * b.cy}
            rx={rx * b.scale}
            ry={ry * b.scale}
            fill={`url(#bloom${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}
