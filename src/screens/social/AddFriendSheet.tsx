/**
 * Add a friend by code — the plus button's sheet on the Friends tab. Mirrors
 * NameSheet's dimmed-scrim card, but captures a friend code (uppercased, no
 * autocorrect) and hands it to the send-request flow. Searching still offers to
 * add an unknown code too; this is just the discoverable, deliberate entry.
 */
import React, {useEffect, useState} from 'react';
import {Keyboard, Modal, Pressable, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Button, Text, TextField} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';

type Props = {
  visible: boolean;
  busy?: boolean;
  onSubmit: (code: string) => void;
  onCancel: () => void;
};

/** A friend code is a handful of letters/digits — cap the field generously. */
const MAX_CODE = 12;

export function AddFriendSheet({visible, busy, onSubmit, onCancel}: Props) {
  const {t} = useTranslation();
  const [value, setValue] = useState('');

  // Start blank each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setValue('');
    }
  }, [visible]);

  const code = value.trim().toUpperCase();

  function confirm() {
    if (code.length === 0 || busy) {
      return;
    }
    onSubmit(code);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable style={styles.card} onPress={Keyboard.dismiss}>
          <Text variant="label" align="center">
            {t('social.addTitle')}
          </Text>
          <Text variant="caption" color="secondary" align="center">
            {t('social.addBody')}
          </Text>
          <TextField
            value={value}
            onChangeText={setValue}
            placeholder={t('social.addPlaceholder')}
            autoFocus
            autoCapitalize="characters"
            maxLength={MAX_CODE}
            returnKeyType="done"
            onSubmitEditing={confirm}
            accessibilityLabel={t('social.addTitle')}
          />
          <Button
            label={t('social.addConfirm')}
            variant="primary"
            onPress={confirm}
            disabled={code.length === 0 || busy}
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
