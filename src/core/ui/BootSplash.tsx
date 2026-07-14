/**
 * The boot loader: the brand ball draws the "m" and lands as its period.
 *
 * One continuous stroke, with the ball as the pen tip: up the left stem, over
 * the first hump, down the middle leg, back up it (the "bounce"), over the
 * second hump, down the short right leg — the m appears behind the ball via a
 * dash reveal on the exact same path — then the ball drops off the leg and
 * settles in its period spot with a small bounce.
 *
 * Geometry mirrors scripts/generate-app-icon.mjs (the app icon mark) in the
 * same 1024 coordinate space. Honors Reduce Motion: renders the finished mark
 * and finishes immediately.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {useColors} from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ---- the mark, in the icon's 1024 space (keep in sync with the icon script)
const STROKE = 92;
const R = 100;
const X1 = 302;
const X2 = X1 + 2 * R;
const X3 = X2 + 2 * R;
const Y_ARC = 430;
const Y_BOT = 660;
const Y_BOT_R = 510;
const BALL_R = 54;
const BALL_CX = X3; // straight under the right leg
const BALL_CY = 650;

// The pen path INCLUDES the middle-leg retrace so the dash reveal and the
// ball tip share one distance axis (re-stroking a drawn line shows nothing).
const PEN_PATH =
  `M ${X1} ${Y_BOT} L ${X1} ${Y_ARC} ` +
  `A ${R} ${R} 0 0 1 ${X2} ${Y_ARC} L ${X2} ${Y_BOT} L ${X2} ${Y_ARC} ` +
  `A ${R} ${R} 0 0 1 ${X3} ${Y_ARC} L ${X3} ${Y_BOT_R}`;

// ---- distance → point sampling for the ball tip
type Seg =
  | {kind: 'line'; len: number; x1: number; y1: number; x2: number; y2: number}
  | {kind: 'arc'; len: number; cx: number; cy: number};

const SEGS: Seg[] = [
  {kind: 'line', len: Y_BOT - Y_ARC, x1: X1, y1: Y_BOT, x2: X1, y2: Y_ARC},
  {kind: 'arc', len: Math.PI * R, cx: X1 + R, cy: Y_ARC},
  {kind: 'line', len: Y_BOT - Y_ARC, x1: X2, y1: Y_ARC, x2: X2, y2: Y_BOT},
  {kind: 'line', len: Y_BOT - Y_ARC, x1: X2, y1: Y_BOT, x2: X2, y2: Y_ARC},
  {kind: 'arc', len: Math.PI * R, cx: X2 + R, cy: Y_ARC},
  {kind: 'line', len: Y_BOT_R - Y_ARC, x1: X3, y1: Y_ARC, x2: X3, y2: Y_BOT_R},
];
const TOTAL = SEGS.reduce((sum, s) => sum + s.len, 0);

function pointAt(d: number): {x: number; y: number} {
  let left = d;
  for (const s of SEGS) {
    if (left <= s.len) {
      const t = left / s.len;
      if (s.kind === 'line') {
        return {x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t};
      }
      // Semicircular hump, left end → right end over the top.
      const theta = Math.PI - Math.PI * t;
      return {x: s.cx + R * Math.cos(theta), y: s.cy - R * Math.sin(theta)};
    }
    left -= s.len;
  }
  return {x: X3, y: Y_BOT_R};
}

// Piecewise-linear keyframes for Animated.interpolate (one shared axis).
const STEPS = 160;
const DIST: number[] = [];
const XS: number[] = [];
const YS: number[] = [];
for (let i = 0; i <= STEPS; i++) {
  const d = (TOTAL * i) / STEPS;
  const p = pointAt(d);
  DIST.push(d);
  XS.push(p.x);
  YS.push(p.y);
}

const DRAW_MS = 1300;
const HOP_MS = 380;

export function BootSplash({onDone}: {onDone?: () => void}) {
  const colors = useColors();
  const draw = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<'draw' | 'hop' | 'done'>('draw');
  const finished = useRef(false);

  const finish = () => {
    if (!finished.current) {
      finished.current = true;
      onDone?.();
    }
  };

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduced => {
        if (!alive) {
          return;
        }
        if (reduced) {
          // No motion: show the finished mark briefly, then hand off.
          draw.setValue(TOTAL);
          hop.setValue(1);
          setPhase('done');
          setTimeout(finish, 250);
          return;
        }
        Animated.timing(draw, {
          toValue: TOTAL,
          duration: DRAW_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false, // drives SVG props
        }).start(({finished: ok}) => {
          if (!alive || !ok) {
            finish();
            return;
          }
          setPhase('hop');
          Animated.timing(hop, {
            toValue: 1,
            duration: HOP_MS,
            easing: Easing.linear, // the bounce shape lives in the keyframes
            useNativeDriver: false,
          }).start(() => {
            setPhase('done');
            setTimeout(finish, 150);
          });
        });
      })
      .catch(finish);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ball position: pen tip while drawing, then the fall-and-settle keyframes.
  const drawCx = draw.interpolate({inputRange: DIST, outputRange: XS});
  const drawCy = draw.interpolate({inputRange: DIST, outputRange: YS});
  // The drop is a straight fall under the leg: overshoot, bounce up, settle.
  const hopCy = hop.interpolate({
    inputRange: [0, 0.6, 0.8, 1],
    outputRange: [Y_BOT_R, BALL_CY + 16, BALL_CY - 8, BALL_CY],
  });
  const cx = phase === 'draw' ? drawCx : BALL_CX;
  const cy = phase === 'draw' ? drawCy : hopCy;

  const dashOffset = draw.interpolate({
    inputRange: [0, TOTAL],
    outputRange: [TOTAL, 0],
  });

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <Svg width={190} height={190} viewBox="0 0 1024 1024">
        <AnimatedPath
          d={PEN_PATH}
          fill="none"
          stroke={colors.ink}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${TOTAL} ${TOTAL}`}
          strokeDashoffset={dashOffset}
        />
        <AnimatedCircle cx={cx} cy={cy} r={BALL_R} fill={colors.primary} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
