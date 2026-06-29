import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, G} from 'react-native-svg';
import {Text} from '../../../core/ui';
import {colors} from '../../../theme';

type TimerRingProps = {
  durationMs: number;
  /** While true the ring ticks down; set false once the player has answered. */
  running: boolean;
  /** Fired once when the ring reaches zero. */
  onTimeout: () => void;
  /**
   * Absolute deadline (ms epoch) to count down to. When set, the ring follows
   * the shared host clock (M4) instead of ticking from mount — so every device
   * shows the same time left. `durationMs` stays the ring's full scale.
   */
  deadlineTs?: number;
  size?: number;
};

const STROKE = 6;
const TICK_MS = 100;

/**
 * Ring colour by fraction of time left (1 = full, 0 = buzzer). Fades smoothly
 * through five stops — bright green → dark green → yellow → orange → red — so the
 * urgency builds continuously instead of snapping at one threshold.
 */
const TIMER_STOPS: {at: number; color: string}[] = [
  {at: 1, color: colors.timerHigh},
  {at: 0.75, color: colors.timerMid},
  {at: 0.5, color: colors.timerWarn},
  {at: 0.25, color: colors.timerCritical},
  {at: 0, color: colors.timerDanger},
];

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function timerColor(fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  // Stops run high→low; find the pair the fraction sits between and blend.
  for (let i = 0; i < TIMER_STOPS.length - 1; i++) {
    const hi = TIMER_STOPS[i];
    const lo = TIMER_STOPS[i + 1];
    if (f <= hi.at && f >= lo.at) {
      const span = hi.at - lo.at || 1;
      const t = (f - lo.at) / span; // 0 at lo, 1 at hi
      const a = parseHex(lo.color);
      const b = parseHex(hi.color);
      const ch = (j: number) => Math.round(a[j] + (b[j] - a[j]) * t);
      return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
    }
  }
  return colors.timerDanger;
}

/**
 * Circular countdown. Drives its own tick so the rest of the Question screen
 * doesn't re-render every frame. Turns red in the final quarter for urgency.
 */
export function TimerRing({
  durationMs,
  running,
  onTimeout,
  deadlineTs,
  size = 120,
}: TimerRingProps) {
  const computeLeft = () =>
    deadlineTs != null
      ? Math.max(0, deadlineTs - Date.now())
      : durationMs;
  const [remaining, setRemaining] = useState(computeLeft);
  const startRef = useRef(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => {
      const left =
        deadlineTs != null
          ? Math.max(0, deadlineTs - Date.now())
          : Math.max(0, durationMs - (Date.now() - startRef.current));
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onTimeout();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [durationMs, running, onTimeout, deadlineTs]);

  const fraction = remaining / durationMs;
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringColor = timerColor(fraction);
  const seconds = Math.ceil(remaining / 1000);

  return (
    <View style={[styles.wrap, {width: size, height: size}]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.divider}
          strokeWidth={STROKE}
          fill="none"
        />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
          />
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text variant="title" style={{color: ringColor}}>
          {seconds}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
