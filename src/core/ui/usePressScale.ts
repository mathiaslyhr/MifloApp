import {useEffect, useRef} from 'react';
import {AccessibilityInfo, Animated, Easing} from 'react-native';

/**
 * The one interaction language shared by every control (buttons, tiles, chips,
 * rows, tabs) — a springy press (design.md §5).
 *
 * Press-in: scale → 0.96 & opacity → 0.9. Press-out: back to 1. Duration 200ms,
 * `Easing.bezier(0.34,1.25,0.64,1)` — the >1 control point gives the springy
 * settle. Touch has no hover, so there's no hover swell.
 *
 * Honors Reduce Motion → opacity-only (scale is pinned to 1).
 *
 * reanimated isn't a dependency, so this uses the RN `Animated` API with the
 * native driver.
 */
const PRESS_EASING = Easing.bezier(0.34, 1.25, 0.64, 1);
const DURATION = 200;

export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => {
        if (mounted) {
          reduceMotion.current = v;
        }
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      v => {
        reduceMotion.current = v;
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const animate = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: reduceMotion.current ? 1 : toScale,
        duration: DURATION,
        easing: PRESS_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: DURATION,
        easing: PRESS_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressIn = () => animate(0.96, 0.9);
  const onPressOut = () => animate(1, 1);

  return {
    /** Spread onto an `Animated.View`'s `style`. */
    animatedStyle: {transform: [{scale}], opacity},
    onPressIn,
    onPressOut,
  };
}
