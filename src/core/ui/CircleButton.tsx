import React from 'react';
import {Animated, Pressable, StyleSheet} from 'react-native';
import {radii, shadows, useThemedStyles, type Palette} from '../../theme';
import {usePressScale} from './usePressScale';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  /** Diameter (default 40). */
  size?: number;
  accessibilityLabel?: string;
};

/**
 * A round "clear" frosted-glass button for corner actions (e.g. the Home help
 * button). Matches the nav island / secondary-button glass language and shares
 * the springy press-scale. Renders a centered child (a glyph or icon).
 */
export function CircleButton({
  children,
  onPress,
  size = 40,
  accessibilityLabel,
}: Props) {
  const press = usePressScale();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}>
      <Animated.View
        style={[
          styles.circle,
          {width: size, height: size, borderRadius: radii.pill},
          press.animatedStyle,
        ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassLight,
      borderWidth: 1,
      borderColor: c.glassRim,
      ...shadows.soft,
    },
  });
