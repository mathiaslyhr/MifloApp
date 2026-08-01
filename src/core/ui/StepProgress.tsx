/**
 * Step progress bar: a chunky rounded track with an accent fill that animates
 * its width as the user moves between steps. Used by quick setup and the
 * guided tour. RN `Animated` on the width (layout prop → `useNativeDriver:
 * false`); reanimated isn't a dependency. Modelled on offside's `CountdownBar`.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {motion, radii, useThemedStyles, type Palette} from '../../theme';

export function StepProgress({step, total}: {step: number; total: number}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const target = total > 0 ? Math.min(1, (step + 1) / total) : 0;
  const w = useRef(new Animated.Value(target)).current;

  useEffect(() => {
    const anim = Animated.timing(w, {
      toValue: target,
      duration: motion.duration.slow,
      easing: motion.easing.out,
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
    // divider, not surfaceSunken: skin 1's sunken IS surface, so on a surface
    // card the track vanished and the bar read as a lone purple line with no
    // "how far" left to see (user report). Same track as ValueCard's bar.
    track: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: c.divider,
      overflow: 'hidden',
    },
    fill: {height: '100%', borderRadius: radii.pill, backgroundColor: c.primary},
  });
