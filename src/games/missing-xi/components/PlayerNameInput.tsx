import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text, TextField} from '../../../core/ui';
import {colors, radii, spacing} from '../../../theme';
import {suggestNames} from '../matching';

type PlayerNameInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Submit the current text as the guess. */
  onSubmit: () => void;
  disabled?: boolean;
};

/** Text field with live autocomplete suggestions from the name index. */
export function PlayerNameInput({
  value,
  onChangeText,
  onSubmit,
  disabled,
}: PlayerNameInputProps) {
  const suggestions = useMemo(() => suggestNames(value), [value]);

  return (
    <View style={styles.wrap}>
      <TextField
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="Type the missing player"
        autoCapitalize="words"
        autoCorrect={false}
        editable={!disabled}
        returnKeyType="done"
        maxLength={32}
      />
      {!disabled && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map(name => (
            <Pressable
              key={name}
              accessibilityRole="button"
              onPress={() => onChangeText(name)}
              style={({pressed}) => [styles.suggestion, pressed && styles.pressed]}>
              <Text variant="body" numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: spacing.sm},
  suggestions: {
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: {opacity: 0.7},
});
