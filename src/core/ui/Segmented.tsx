import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type {LucideIcon} from 'lucide-react-native';
import {
  motion,
  radii,
  spacing,
  type as typeScale,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {Text} from './Text';
import {PressableScale} from './PressableScale';
import {getReduceMotion} from './reduceMotion';
import {haptics} from '../haptics';

export type SegmentedOption<K extends string> = {
  key: K;
  label: string;
  /** Optional leading glyph, tinted to match the segment's text colour. */
  Icon?: LucideIcon;
};

/** Track padding and inter-segment gap. The thumb's geometry is derived from these. */
const PAD = 4;
const GAP = 4;

/**
 * Where the thumb sits for a given segment, given the measured track width.
 * Pure, so the geometry is testable without a renderer.
 */
export function segmentedThumb(trackWidth: number, count: number, index: number) {
  const width = (trackWidth - PAD * 2 - GAP * (count - 1)) / count;
  return {width, x: PAD + index * (width + GAP)};
}

/**
 * A two-plus-option in-page segmented toggle (e.g. Friendlies | Competitive):
 * a `surface2` track holding equal-width segments. A brand-purple thumb slides
 * under the selected one; unselected labels read as `textSecondary`. Each
 * segment shares the springy press-scale.
 *
 * The thumb has to be measured (`onLayout`) rather than laid out in percentages,
 * because only transform and opacity go on the native driver and `%` isn't
 * animatable there.
 *
 * Each label is rendered twice, stacked, and cross-faded on opacity. That looks
 * like a lot of machinery for a colour change, and it is — but colour can't be
 * native-driven, and swapping the tint instantly leaves the outgoing label
 * sitting at `textSecondary` on top of the thumb that's still sliding out from
 * under it, which is a visible ~100ms of bad contrast. Opacity is the only
 * native-drivable way to cross-fade a tint. The duplicate layers are hidden
 * from VoiceOver; `PressableScale` carries the real label and selected state.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [trackW, setTrackW] = useState(0);
  const index = Math.max(0, options.findIndex(o => o.key === value));
  const x = useRef(new Animated.Value(0)).current;
  // One fade per segment, grown if a caller ever passes more options than it
  // started with. Snapshotting the initial length would leave `fades[i]`
  // undefined for the new ones; today's callers are static, the next may not be.
  const fadesRef = useRef<Animated.Value[]>([]);
  if (fadesRef.current.length !== options.length) {
    fadesRef.current = options.map(
      (_, i) => fadesRef.current[i] ?? new Animated.Value(0),
    );
  }
  const fades = fadesRef.current;
  const measured = useRef(false);

  useEffect(() => {
    if (!trackW) {
      return;
    }
    const {x: to} = segmentedThumb(trackW, options.length, index);
    const reduceMotion = getReduceMotion();
    // The first measure must land, not travel: otherwise the thumb slides in
    // from segment 0 every time the component mounts.
    if (!measured.current || reduceMotion) {
      measured.current = true;
      x.setValue(to);
      fades.forEach((f, i) => f.setValue(i === index ? 1 : 0));
      return;
    }
    Animated.parallel([
      Animated.timing(x, {
        toValue: to,
        duration: motion.duration.base,
        easing: motion.easing.spring,
        useNativeDriver: true,
      }),
      ...fades.map((f, i) =>
        Animated.timing(f, {
          toValue: i === index ? 1 : 0,
          duration: motion.duration.base,
          easing: motion.easing.spring,
          useNativeDriver: true,
        }),
      ),
    ]).start();
  }, [index, trackW, x, fades, options.length]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== trackW) {
      setTrackW(w);
    }
  };

  const thumb = trackW ? segmentedThumb(trackW, options.length, index) : null;

  return (
    <View style={styles.track} onLayout={onTrackLayout}>
      {/* Declared before the segments so it paints behind them: same-zIndex
          siblings stack in declaration order. */}
      {thumb ? (
        <Animated.View
          style={[
            styles.thumb,
            {width: thumb.width, transform: [{translateX: x}]},
          ]}
        />
      ) : null}
      {options.map((opt, i) => {
        const selected = opt.key === value;
        return (
          <PressableScale
            key={opt.key}
            containerStyle={styles.segmentContainer}
            accessibilityRole="button"
            accessibilityState={{selected}}
            accessibilityLabel={opt.label}
            onPress={() => {
              if (!selected) {
                haptics.tap();
                onChange(opt.key);
              }
            }}
            style={styles.segment}>
            <SegmentLabel
              opt={opt}
              tint={colors.textSecondary}
              opacity={fades[i].interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              })}
              styles={styles}
            />
            <SegmentLabel
              opt={opt}
              tint={colors.onInk}
              opacity={fades[i]}
              styles={styles}
              overlay
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * One tinted layer of a segment's label. Two of these stack per segment and
 * cross-fade; both are hidden from VoiceOver so the duplicate doesn't read out
 * (the pressable above carries the real label).
 */
function SegmentLabel<K extends string>({
  opt,
  tint,
  opacity,
  styles,
  overlay,
}: {
  opt: SegmentedOption<K>;
  tint: string;
  opacity: Animated.AnimatedInterpolation<number> | Animated.Value;
  styles: ReturnType<typeof makeStyles>;
  overlay?: boolean;
}) {
  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.labelLayer, overlay && styles.labelOverlay, {opacity}]}>
      {opt.Icon ? <opt.Icon size={16} color={tint} strokeWidth={2} /> : null}
      <Text style={[styles.label, {color: tint}]}>{opt.label}</Text>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: c.surface2,
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
      padding: PAD,
      gap: GAP,
    },
    segmentContainer: {flex: 1},
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: radii.pill,
    },
    thumb: {
      position: 'absolute',
      top: PAD,
      bottom: PAD,
      left: 0,
      borderRadius: radii.pill,
      backgroundColor: c.primary,
    },
    labelLayer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    // The tinted twin sits exactly over the base layer rather than beside it.
    labelOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
    label: {...typeScale.label},
  });
