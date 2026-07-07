import React from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {colors, radii, type as typeScale} from '../../theme';
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
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * The pill button — three variants, all fully round (design.md §3), all sharing
 * the springy press-scale:
 *  - `primary`   solid black ink, white hairline rim + soft lift (marketing SolidButton)
 *  - `secondary` frosted white glass, ink text (the "Join a party" pill)
 *  - `outline`   ink-hairline border on light glass (tertiary CTA)
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  fullWidth = true,
  disabled = false,
  style,
  accessibilityHint,
}: Props) {
  const press = usePressScale();
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
      onPress={handlePress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled}}
      style={fullWidth ? styles.fullWidth : undefined}>
      <Animated.View
        style={[
          styles.base,
          VARIANT_STYLES[variant],
          isPrimary && styles.primaryLift,
          variant === 'secondary' && styles.glassLift,
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

const VARIANT_STYLES: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.solidRim,
  },
  secondary: {
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  outline: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(13,13,22,0.20)',
  },
};

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
  primaryLift: {
    shadowColor: '#140F32',
    shadowOpacity: 0.35,
    shadowOffset: {width: 0, height: 12},
    shadowRadius: 20,
    elevation: 8,
  },
  // Soft frosted-glass lift — matches CircleButton / the nav island.
  glassLift: {
    shadowColor: '#140F32',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 4,
  },
  disabled: {opacity: 0.5},
  label: {...typeScale.label, textAlign: 'center'},
});
