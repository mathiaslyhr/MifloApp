/**
 * CrestWall — a faint, decorative wall of real club crests. It is aggregate
 * art: it shows many crests at once and reveals no daily's answer, so it is
 * safe on any surface (loading, empty, the "all done" card, onboarding).
 * Purely atmospheric — it fills its parent, sits BEHIND the content, and passes
 * every touch through (pointerEvents none). The parent should clip it
 * (overflow: 'hidden') and give it something to sit behind.
 */
import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {LOGO_IMAGES} from '../../games/hattrick/assets/logos.generated';

const ALL_CRESTS = Object.values(LOGO_IMAGES);

/** A fresh sample of `count` distinct crests (Fisher–Yates on a copy). A new
 * shuffle per mount is fine — it is decoration, not data. */
function sampleCrests(count: number): number[] {
  const pool = ALL_CRESTS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

type Props = {
  /** How many crests to scatter. */
  count?: number;
  /** Crest edge length. */
  size?: number;
  /** Overall opacity of the wall (kept low so it reads as texture, not content). */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

export function CrestWall({
  count = 24,
  size = 40,
  opacity = 0.08,
  style,
}: Props): React.JSX.Element {
  const crests = React.useMemo(() => sampleCrests(count), [count]);
  return (
    <View
      style={[styles.wall, {opacity}, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {crests.map((src, i) => (
        <Image
          key={i}
          source={src}
          resizeMode="contain"
          style={[styles.crest, {width: size, height: size}]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crest: {margin: 6},
});
