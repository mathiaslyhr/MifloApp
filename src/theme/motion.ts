/**
 * Motion tokens — the app's one timing language.
 *
 * reanimated is deliberately not a dependency. RN's `Animated` with
 * `useNativeDriver: true` already runs transform and opacity on the UI thread,
 * so there is no frame-rate argument for adding it. See docs/design.md §4.
 *
 * The easings are shared module-level instances on purpose. `Easing.bezier`
 * precomputes its sample table at construction and the returned function is
 * pure, so one instance is safe across any number of concurrent animations
 * (RN itself does the same for `Easing.ease`). Under the native driver the
 * easing is sampled into a frames array once, on JS, when the animation
 * starts — so a custom bezier costs nothing per frame.
 *
 * This module must keep importing nothing but `react-native`: the theme barrel
 * is imported almost everywhere, and anything heavy here taxes startup.
 */
import {Easing} from 'react-native';

export const motion = {
  duration: {
    /** Scrims and micro-fades. Shouldn't be noticed. */
    fast: 150,
    /** The default: press, thumb slide, toast enter/exit. */
    base: 200,
    /** Page-level: the tab cross-fade. */
    slow: 300,
    /** One breath of an ambient loop (the skeleton pulse). */
    pulse: 700,
  },
  easing: {
    /** The press language. The >1 control point gives the springy settle. */
    spring: Easing.bezier(0.34, 1.25, 0.64, 1),
    /** Decelerate, no overshoot. Things arriving or leaving. */
    out: Easing.bezier(0.23, 1, 0.32, 1),
    /** Symmetric, for cross-fades where neither end is an event. */
    inOut: Easing.inOut(Easing.ease),
  },
  /** The press zoom's resting targets. */
  press: {scale: 0.96, opacity: 0.9},
  /** Stagger: `step` per item, capped at `maxItems` so a long list can't crawl. */
  stagger: {step: 40, maxItems: 6},
} as const;
