import React from 'react';
import {StyleSheet, TextInput, type TextInputProps} from 'react-native';
import {colors, fontFamily, radii, spacing} from '../../theme';

type TextFieldProps = TextInputProps & {
  /**
   * `text` is a normal single-line field; `code` is the big, centered,
   * letter-spaced style for short game codes.
   */
  variant?: 'text' | 'code';
};

/**
 * Themed text input on a `surface` fill. Wraps RN `TextInput` so call sites
 * never reach for raw font/color values.
 */
export function TextField({variant = 'text', style, ...rest}: TextFieldProps) {
  const isCode = variant === 'code';
  return (
    <TextInput
      placeholderTextColor={colors.textSecondary}
      style={[styles.base, isCode ? styles.code : styles.text, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
  },
  text: {
    height: 56,
    fontFamily: fontFamily.regular,
    fontSize: 17,
  },
  code: {
    height: 76,
    fontFamily: fontFamily.medium,
    fontSize: 30,
    letterSpacing: 8,
    textAlign: 'center',
  },
});
