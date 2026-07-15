/**
 * The € curve — the career page's headline.
 *
 * Two decisions carry this chart. The y range is the data's own min/max plus a
 * margin, never 0 → €250M: anchored to the cap, a real €10M account draws a
 * flat line along the floor and says nothing (which is exactly what the Play
 * tab's progress bar does today). And the rungs of the tier ladder are drawn
 * behind the curve, so the number becomes a story — you can see the match that
 * pushed you into First Team.
 *
 * Straight segments, no smoothing: every vertex IS a match, and a spline would
 * invent € between two of them that were never held.
 *
 * Marks are SVG; the tier labels are real RN Text in a right-hand gutter, so
 * they keep Satoshi and the design system's colours rather than SVG's own font
 * handling — and a gutter means a label can never sit on top of the curve.
 */
import React, {useId, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Line, Path, Stop} from 'react-native-svg';
import {Text} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {TIERS} from '../../games/ranked-hattrick/tiers';
import {domainFor} from '../../games/ranked-hattrick/history';

/** Room on the right for a tier name ("World class" / "Nøglespiller"). */
const GUTTER = 76;
const HEIGHT = 148;

type Props = {
  /** € standings, oldest → newest (seriesFrom). Under 2 points draws nothing. */
  series: number[];
  tierLabel: (key: string) => string;
};

export function ValueChart({series, tierLabel}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const gradId = useId();
  const [w, setW] = useState(0);

  const plotW = Math.max(0, w - GUTTER);
  const ready = w > 0 && series.length >= 2;

  const {min, max} = domainFor(series);
  const span = max - min; // domainFor guarantees > 0.
  const x = (i: number) => (i / (series.length - 1)) * plotW;
  const y = (v: number) => HEIGHT - ((v - min) / span) * HEIGHT;

  const points = ready ? series.map((v, i) => ({x: x(i), y: y(v)})) : [];
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  // Close the area down the two ends to the baseline so the gradient has a
  // shape to fill.
  const area = ready
    ? `${line} L${points[points.length - 1].x} ${HEIGHT} L${points[0].x} ${HEIGHT} Z`
    : '';

  // Only the rungs the curve actually lives between — a ladder drawn outside
  // the visible € would be noise.
  const rungs = ready
    ? TIERS.filter(t => t.min > min && t.min < max).map(t => ({key: t.key, y: y(t.min)}))
    : [];

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

        {rungs.map(r => (
          <Line
            key={r.key}
            x1={0}
            y1={r.y}
            x2={plotW}
            y2={r.y}
            stroke={colors.divider}
            strokeWidth={1}
            // Dashed so a threshold never reads as data.
            strokeDasharray="2 4"
          />
        ))}

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

      {rungs.map(r => (
        <Text
          key={r.key}
          variant="caption"
          color="muted"
          numberOfLines={1}
          style={[styles.rungLabel, {top: r.y - 8}]}>
          {tierLabel(r.key)}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    root: {height: HEIGHT},
    rungLabel: {
      position: 'absolute',
      right: 0,
      width: GUTTER - spacing.sm,
      textAlign: 'right',
    },
  });
