import React from 'react';
import {Pressable, StyleSheet, View, type ViewStyle} from 'react-native';
import {colors, radii, minTapTarget, spacing} from '../../theme';
import {Text} from './Text';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * Primary action button. Use one `primary` button per screen (accent is
 * spent sparingly); `secondary` is an outlined alternative.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled}}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <View pointerEvents="none">
        <Text
          variant="body"
          color={isPrimary ? 'textPrimary' : 'textPrimary'}
          style={styles.label}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTapTarget + 8, // generous primary CTA height
    borderRadius: radii.button,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontWeight: '500',
  },
});
