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
  size?: number;
};

const STROKE = 6;
const TICK_MS = 100;

/**
 * Circular countdown. Drives its own tick so the rest of the Question screen
 * doesn't re-render every frame. Turns red in the final quarter for urgency.
 */
export function TimerRing({
  durationMs,
  running,
  onTimeout,
  size = 120,
}: TimerRingProps) {
  const [remaining, setRemaining] = useState(durationMs);
  const startRef = useRef(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => {
      const left = Math.max(0, durationMs - (Date.now() - startRef.current));
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onTimeout();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [durationMs, running, onTimeout]);

  const fraction = remaining / durationMs;
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const low = fraction <= 0.25;
  const ringColor = low ? colors.error : colors.primary;
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
        <Text variant="title" color={low ? 'error' : 'textPrimary'}>
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
