import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {colors, radii, shadows} from '../../theme';
import {AppBlur} from './Blur';

type Props = {
  children?: React.ReactNode;
  /** Glass fill: `'regular'` → `colors.glass` (0.55), `'light'` → `colors.glassLight` (0.40). */
  tint?: 'light' | 'regular';
  /** Exact fill override for surfaces that need their own tint (e.g. the role reveal's 0.6). */
  tintColor?: string;
  /** Ambient lift. Most in-flow glass cards sit flush (`'none'`). */
  shadow?: 'none' | 'soft' | 'floating';
  /**
   * Backdrop blur amount. When set, the card renders the two-layer Liquid Glass
   * structure: the outer view keeps border + shadow unclipped while an inner
   * layer clips a real `AppBlur` + tint to the corners.
   */
  blur?: number;
  radius?: 'card' | 'pill';
  borderWidth?: number;
  borderColor?: string;
  /** Padding, gap, layout, overflow, or a bespoke shadow live at the call site. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The shared glass surface (design.md §3): translucent white fill + bright rim
 * on the rainbow canvas. Every glass card in the app reads from this recipe so
 * the material stays one piece across screens.
 */
export function GlassCard({
  children,
  tint = 'regular',
  tintColor,
  shadow = 'none',
  blur,
  radius = 'card',
  borderWidth = 1,
  borderColor = colors.glassRim,
  style,
}: Props) {
  const fill = tintColor ?? (tint === 'light' ? colors.glassLight : colors.glass);
  const borderRadius = radii[radius];
  const frame: ViewStyle = {borderRadius, borderWidth, borderColor};
  const lift = shadow === 'none' ? undefined : shadows[shadow];

  if (blur == null) {
    return (
      <View style={[frame, {backgroundColor: fill}, lift, style]}>
        {children}
      </View>
    );
  }

  // Two-layer Liquid Glass: `overflow: 'hidden'` on the outer view would clip
  // its own shadow on iOS, so the clip lives on an inner absolute fill instead.
  return (
    <View style={[frame, lift, style]}>
      <View style={[styles.blurClip, {borderRadius}]} pointerEvents="none">
        <AppBlur amount={blur} />
        <View style={[StyleSheet.absoluteFill, {backgroundColor: fill}]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blurClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
});
