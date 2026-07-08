import React, {useEffect, useState} from 'react';
import {Keyboard, Modal, Pressable, StyleSheet} from 'react-native';
import {colors, radii, spacing} from '../../theme';
import {Button} from './Button';
import {Text} from './Text';
import {TextField} from './TextField';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Seeds the field each time the sheet opens (e.g. current name on rename). */
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  maxLength?: number;
};

/**
 * A single-field name modal on a dimmed scrim — the app's one identity capture.
 * Since Miflo keeps no saved name, this pops on every Create (and lobby rename,
 * and Join later): the player types a name for the round, no memory.
 */
export function NameSheet({
  visible,
  title,
  subtitle,
  initialValue = '',
  placeholder = 'Your name',
  confirmLabel,
  onConfirm,
  onCancel,
  maxLength = 20,
}: Props) {
  const [value, setValue] = useState(initialValue);

  // Reseed whenever the sheet (re)opens so rename shows the current name and
  // Create starts blank.
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  const trimmed = value.trim();

  function confirm() {
    if (trimmed.length === 0) {
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}>
      {/* Anchored near the top so it never slides when the keyboard opens — it
          just appears in place. */}
      <Pressable style={styles.scrim} onPress={onCancel}>
        {/* Card keeps taps off the scrim (no accidental dismiss) and drops the
            keyboard when you tap it. */}
        <Pressable style={styles.card} onPress={Keyboard.dismiss}>
          <Text variant="label" align="center">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="secondary" align="center">
              {subtitle}
            </Text>
          ) : null}
          <TextField
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            autoFocus
            maxLength={maxLength}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={confirm}
            accessibilityLabel={title}
          />
          <Button
            label={confirmLabel}
            variant="primary"
            onPress={confirm}
            disabled={trimmed.length === 0}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13,13,22,0.35)',
    justifyContent: 'flex-start',
    paddingTop: 150,
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.24,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 32,
    elevation: 12,
  },
});
