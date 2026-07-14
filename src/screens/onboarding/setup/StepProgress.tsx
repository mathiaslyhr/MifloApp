/**
 * The onboarding progress bar: a chunky rounded track with an accent fill that
 * animates its width as the user moves between steps. RN `Animated` on the width
 * (layout prop → `useNativeDriver: false`); reanimated isn't a dependency.
 * Modelled on offside's `CountdownBar`.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {radii, useThemedStyles, type Palette} from '../../../theme';

export function StepProgress({step, total}: {step: number; total: number}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const target = total > 0 ? Math.min(1, (step + 1) / total) : 0;
  const w = useRef(new Animated.Value(target)).current;

  useEffect(() => {
    const anim = Animated.timing(w, {
      toValue: target,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [w, target]);

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {width: w.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']})},
        ]}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    track: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
    },
    fill: {height: '100%', borderRadius: radii.pill, backgroundColor: c.primary},
  });
