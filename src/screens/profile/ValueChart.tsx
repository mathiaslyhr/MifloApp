/**
 * The € curve — the career page's headline.
 *
 * The one decision that carries this chart: the y range is the data's own
 * min/max plus a margin, never 0 → €250M. Anchored to the cap, a real €10M
 * account draws a flat line along the floor and says nothing (which is exactly
 * what the Play tab's progress bar does today). A career is only legible
 * against the € it actually lived in.
 *
 * Straight segments, no smoothing: every vertex IS a match, and a spline would
 * invent € between two of them that were never held.
 */
import React, {useId, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Path, Stop} from 'react-native-svg';
import {useColors, useThemedStyles, type Palette} from '../../theme';
import {domainFor} from '../../games/ranked-hattrick/history';

const HEIGHT = 148;

type Props = {
  /** € standings, oldest → newest (seriesFrom). Under 2 points draws nothing. */
  series: number[];
};

export function ValueChart({series}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const gradId = useId();
  const [w, setW] = useState(0);

  const ready = w > 0 && series.length >= 2;

  const {min, max} = domainFor(series);
  const span = max - min; // domainFor guarantees > 0.
  const x = (i: number) => (i / (series.length - 1)) * w;
  const y = (v: number) => HEIGHT - ((v - min) / span) * HEIGHT;

  const points = ready ? series.map((v, i) => ({x: x(i), y: y(v)})) : [];
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  // Close the area down the two ends to the baseline so the gradient has a
  // shape to fill.
  const area = ready
    ? `${line} L${points[points.length - 1].x} ${HEIGHT} L${points[0].x} ${HEIGHT} Z`
    : '';

  const last = points[points.length - 1];

  return (
    <View
      style={styles.root}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      accessibilityRole="image">
      <Svg width="100%" height={HEIGHT}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset={1} stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {ready ? (
          <>
            <Path d={area} fill={`url(#${gradId})`} />
            <Path
              d={line}
              stroke={colors.primary}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Where the career stands right now. */}
            <Circle cx={last.x} cy={last.y} r={7} fill={colors.primary} opacity={0.22} />
            <Circle cx={last.x} cy={last.y} r={3.5} fill={colors.primary} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    root: {height: HEIGHT},
  });
