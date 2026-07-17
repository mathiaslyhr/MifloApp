/**
 * PitchMarkings — the football-pitch lines behind the Team sheet formation,
 * drawn in the theme's `divider` grey. No green, no texture: the same "borders
 * one step lighter than the surface" rule the rest of the app follows, just
 * arranged as a halfway line, a centre circle + spot, and a penalty box + "D"
 * arc at each goal line. Purely decorative — it fills its parent, sits BEHIND
 * the tokens, and passes every touch through (pointerEvents none) so tapping
 * the pitch still clears the targeted slot.
 *
 * The board renders attack-first / GK-last, so the top goal line is the one the
 * XI attacks and the bottom is the keeper's; the markings are symmetric, so
 * that orientation needs no special-casing.
 */
import React, {useState} from 'react';
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg';
import {useColors} from '../../theme';

export function PitchMarkings(): React.JSX.Element {
  const colors = useColors();
  const [size, setSize] = useState<{w: number; h: number} | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setSize(prev =>
      prev && prev.w === width && prev.h === height ? prev : {w: width, h: height},
    );
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size && size.w > 0 && size.h > 0 ? (
        <Markings w={size.w} h={size.h} color={colors.divider} />
      ) : null}
    </View>
  );
}

function Markings({w, h, color}: {w: number; h: number; color: string}) {
  const cx = w / 2;
  const cy = h / 2;
  const line = {stroke: color, strokeWidth: 1.5, fill: 'none'} as const;

  const circleR = Math.min(w, h) * 0.11;
  const boxW = w * 0.46;
  const boxH = Math.min(h * 0.13, 64);
  const boxX = (w - boxW) / 2;
  // The "D": the penalty-spot arc poking out of the box into the pitch.
  const arcR = boxW * 0.34;
  const arcHalf = arcR * 0.82;
  // Top arc bows down into the pitch (sweep 0); bottom arc bows up (sweep 1).
  const topArc = `M ${cx - arcHalf} ${boxH} A ${arcR} ${arcR} 0 0 0 ${cx + arcHalf} ${boxH}`;
  const bottomArc = `M ${cx - arcHalf} ${h - boxH} A ${arcR} ${arcR} 0 0 1 ${cx + arcHalf} ${h - boxH}`;

  return (
    <Svg width={w} height={h}>
      <Line x1={0} y1={cy} x2={w} y2={cy} {...line} />
      <Circle cx={cx} cy={cy} r={circleR} {...line} />
      <Circle cx={cx} cy={cy} r={1.6} fill={color} />
      <Rect x={boxX} y={0} width={boxW} height={boxH} rx={2} {...line} />
      <Rect x={boxX} y={h - boxH} width={boxW} height={boxH} rx={2} {...line} />
      <Path d={topArc} {...line} />
      <Path d={bottomArc} {...line} />
    </Svg>
  );
}
