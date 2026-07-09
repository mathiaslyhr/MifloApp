/**
 * Loading placeholder: a glass block with a gentle opacity pulse, used where a
 * screen waits on the network (lobby roster, online boards). Same material as
 * GlassCard (translucent white, zero shadow, in-flow) so the ghost layout
 * reads as the real one about to arrive. Core `Animated` only — the project
 * pins legacy gesture-handler and ships no Reanimated.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, type StyleProp, type ViewStyle} from 'react-native';
import {colors, radii} from '../../theme';

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
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration: 700, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 700, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.9],
  });

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      style={[
        {width, height, borderRadius: radius, backgroundColor: colors.glass, opacity},
        style,
      ]}
    />
  );
}
