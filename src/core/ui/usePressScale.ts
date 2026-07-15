import {useRef} from 'react';
import {Animated} from 'react-native';
import {motion} from '../../theme';
import {getReduceMotion} from './reduceMotion';

/**
 * The one interaction language shared by every control (buttons, tiles, chips,
 * rows, tabs) — a springy press.
 *
 * Press-in: scale → 0.96 & opacity → 0.9. Press-out: back to 1. Timing and
 * easing come from `motion` (src/theme/motion.ts); the bezier's >1 control
 * point gives the springy settle. Touch has no hover, so there's no hover swell.
 *
 * Honors Reduce Motion → opacity-only (scale is pinned to 1). The flag is read
 * synchronously per press from the app-wide cache in `reduceMotion.ts`, so this
 * hook holds no state and never re-renders its consumer.
 *
 * reanimated isn't a dependency, so this uses the RN `Animated` API with the
 * native driver.
 */
export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animate = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: getReduceMotion() ? 1 : toScale,
        duration: motion.duration.base,
        easing: motion.easing.spring,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: motion.duration.base,
        easing: motion.easing.spring,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressIn = () => animate(motion.press.scale, motion.press.opacity);
  const onPressOut = () => animate(1, 1);

  return {
    /** Spread onto an `Animated.View`'s `style`. */
    animatedStyle: {transform: [{scale}], opacity},
    onPressIn,
    onPressOut,
  };
}
