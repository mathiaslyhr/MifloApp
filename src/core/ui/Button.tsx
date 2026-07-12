import React from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {radii, type as typeScale, useColors, type Palette} from '../../theme';
import {haptics} from '../haptics';
import {usePressScale} from './usePressScale';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Stretch to fill the container width (default true — Home stacks full-width). */
  fullWidth?: boolean;
  disabled?: boolean;
  /**
   * When set, a disabled button keeps its greyed look but stays tappable and
   * routes presses here instead of `onPress` — so the tap can explain *why*
   * the action is unavailable (toast/haptic) rather than dying silently.
   * The caller owns the feedback; no confirm haptic or press-scale fires.
   */
  onDisabledPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * The pill button — three variants, all fully round (design.md §3), all sharing
 * the springy press-scale:
 *  - `primary`   solid black ink, white hairline rim, fully flat (no shadow —
 *                the ink fill alone carries the hierarchy on the pastel mesh)
 *  - `secondary` frosted white glass, ink text (the "Join a party" pill)
 *  - `outline`   ink-hairline border on light glass (tertiary CTA)
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  fullWidth = true,
  disabled = false,
  onDisabledPress,
  style,
  accessibilityHint,
}: Props) {
  const press = usePressScale();
  const colors = useColors();
  const isPrimary = variant === 'primary';

  // A light tap confirms the press landed (no-op when haptics are off/absent).
  const handlePress = onPress
    ? () => {
        haptics.tap();
        onPress();
      }
    : undefined;

  return (
    <Pressable
      onPress={disabled ? onDisabledPress : handlePress}
      onPressIn={disabled ? undefined : press.onPressIn}
      onPressOut={disabled ? undefined : press.onPressOut}
      disabled={disabled && !onDisabledPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled}}
      style={fullWidth ? styles.fullWidth : undefined}>
      <Animated.View
        style={[
          styles.base,
          variantStyles(colors)[variant],
          disabled && styles.disabled,
          press.animatedStyle,
          style,
        ]}>
        <Animated.Text
          style={[
            styles.label,
            {color: isPrimary ? colors.onInk : colors.ink},
          ]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const variantStyles = (c: Palette): Record<ButtonVariant, ViewStyle> => ({
  primary: {
    backgroundColor: c.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.solidRim,
  },
  secondary: {
    backgroundColor: c.glassLight,
    borderWidth: 1,
    borderColor: c.glassRim,
  },
  outline: {
    backgroundColor: c.glassLight,
    borderWidth: 1,
    borderColor: c.divider,
  },
});

const styles = StyleSheet.create({
  fullWidth: {alignSelf: 'stretch'},
  base: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {opacity: 0.5},
  label: {...typeScale.label, textAlign: 'center'},
});
