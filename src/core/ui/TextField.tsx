import React, {useState} from 'react';
import {StyleProp, StyleSheet, TextInput, TextStyle} from 'react-native';
import {colors, fonts, radii, spacing} from '../../theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  /** Sentence-case a nickname, all-caps a room code, etc. */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Fires on the keyboard return key (e.g. confirm the prompt). */
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'go' | 'next';
  /** Grow to a multi-line box (e.g. a feedback message). */
  multiline?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * A single-line text field. An opaque white fill with a hairline border, fully
 * rounded (pill/capsule), so it reads identically on any background — the
 * lavender canvas and white cards alike. The border lifts to the brand color on
 * focus. Every input in the app routes through this component.
 */
export function TextField({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  maxLength,
  autoCapitalize = 'sentences',
  onSubmitEditing,
  returnKeyType = 'done',
  multiline = false,
  accessibilityLabel,
  style,
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      autoFocus={autoFocus}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      multiline={multiline}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.field,
        multiline && styles.fieldMultiline,
        focused && styles.fieldFocused,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    alignSelf: 'stretch',
    minHeight: 48,
    // 2px border always reserved so the focus color doesn't shift height.
    paddingVertical: 12,
    paddingHorizontal: spacing.lg - 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.divider,
    color: colors.ink,
    // Explicit font WITHOUT a lineHeight — a tight lineHeight clips descenders
    // (g/y/p) on a single-line TextInput.
    fontFamily: fonts.regular,
    fontSize: 16,
    textAlignVertical: 'center',
  },
  fieldMultiline: {
    minHeight: 112,
    // A tall box shouldn't become a stadium — soften to the card radius instead
    // of the single-line pill.
    borderRadius: radii.card,
    // Multi-line boxes anchor text to the top and need room for descenders.
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  fieldFocused: {
    borderColor: colors.primary,
  },
});
