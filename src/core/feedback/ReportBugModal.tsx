/**
 * ReportBugModal — a lightweight sheet for sending a bug report without leaving
 * the current screen. Mirrors the in-game picker Modal (light scrim + centered
 * card) and posts straight to `submitFeedback('bug', …)`. On success it toasts +
 * buzzes and closes; errors surface as an error toast so the user isn't blocked.
 *
 * Reusable anywhere — the in-game Header and (later) the Menu both mount it.
 */
import React, {useState} from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Button, TextField, Text} from '../ui';
import {haptics} from '../haptics';
import {toast} from '../ui';
import {colors, radii, spacing} from '../../theme';
import {submitFeedback} from './service';
import {BackendUnavailableError} from '../rooms/roomService';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MAX_LEN = 600;

export function ReportBugModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) {
      return;
    }
    setMessage('');
    onClose();
  }

  async function handleSubmit() {
    const trimmed = message.trim();
    if (busy || trimmed === '') {
      return;
    }
    setBusy(true);
    try {
      await submitFeedback('bug', trimmed);
      haptics.success();
      toast.success(t('bug.thanks'));
      setMessage('');
      onClose();
    } catch (err) {
      haptics.error();
      toast.error(
        err instanceof BackendUnavailableError ? t('bug.unavailable') : t('bug.error'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="label" align="center">
            {t('bug.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('bug.desc')}
          </Text>
          <TextField
            value={message}
            onChangeText={setMessage}
            placeholder={t('bug.placeholder')}
            autoFocus
            multiline
            maxLength={MAX_LEN}
            autoCapitalize="sentences"
            accessibilityLabel={t('bug.placeholder')}
          />
          <View style={styles.actions}>
            <Button
              label={busy ? t('bug.sending') : t('bug.send')}
              variant="primary"
              onPress={handleSubmit}
              disabled={busy || message.trim() === ''}
            />
            <Button label={t('common.cancel')} variant="secondary" onPress={close} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13,13,22,0.15)',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: {gap: spacing.sm, marginTop: spacing.xs},
});
