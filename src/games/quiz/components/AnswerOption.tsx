import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Icon, Text} from '../../../core/ui';
import {colors, minTapTarget, radii, spacing} from '../../../theme';

/**
 * idle = tappable; selected = your locked choice while the round waits to reveal;
 * correct/wrong/muted = post-answer reveal states.
 */
export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted';

type AnswerOptionProps = {
  label: string;
  state?: AnswerState;
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * One answer choice. Used tappable on the Question screen and as a static
 * coloured reveal (green correct / red wrong) on the Reveal screen.
 */
export function AnswerOption({
  label,
  state = 'idle',
  onPress,
  disabled,
}: AnswerOptionProps) {
  const selected = state === 'selected';
  const correct = state === 'correct';
  const wrong = state === 'wrong';
  const muted = state === 'muted';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        selected && styles.selected,
        correct && styles.correct,
        wrong && styles.wrong,
        muted && styles.muted,
        pressed && !disabled && styles.pressed,
      ]}>
      <View pointerEvents="none" style={styles.inner}>
        <Text variant="body" style={styles.label}>
          {label}
        </Text>
        {correct && <Icon name="check" size={20} color="success" />}
        {wrong && <Icon name="x" size={20} color="error" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTapTarget + 8,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  selected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  correct: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success,
  },
  wrong: {
    backgroundColor: colors.errorMuted,
    borderColor: colors.error,
  },
  muted: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    flex: 1,
  },
});
