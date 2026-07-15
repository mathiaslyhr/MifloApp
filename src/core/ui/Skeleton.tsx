/**
 * Loading placeholder: a surface-2 block with a gentle opacity pulse, used
 * where a screen waits on the network (lobby roster, online boards). Same
 * material as the app's cards (solid surface, zero shadow, in-flow) so the
 * ghost layout reads as the real one about to arrive. Core `Animated` only —
 * the project ships no Reanimated (see docs/design.md §4).
 *
 * Under Reduce Motion the pulse doesn't run at all: an endless loop is the
 * least welcome kind of motion there is. The block still renders, mid-pulse,
 * so the ghost layout reads the same.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, type StyleProp, type ViewStyle} from 'react-native';
import {motion, radii, useColors} from '../../theme';
import {useReduceMotion} from './reduceMotion';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  /** Corner radius; defaults to the card radius. */
  radius?: number;
  /** Screen-reader text carried over from the loading copy it replaces. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.card,
  accessibilityLabel,
  style,
}: Props) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.duration.pulse,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: motion.duration.pulse,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  // Reduce Motion rests it mid-pulse rather than at either extreme, so the
  // block reads as a placeholder and not as content that failed to load.
  const opacity = reduceMotion
    ? 0.6
    : pulse.interpolate({inputRange: [0, 1], outputRange: [0.45, 0.9]});

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      style={[
        {width, height, borderRadius: radius, backgroundColor: colors.surface2, opacity},
        style,
      ]}
    />
  );
}
