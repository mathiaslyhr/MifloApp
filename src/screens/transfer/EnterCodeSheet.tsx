/**
 * Move a profile ONTO this (new) phone. The other half of the handshake lives
 * on the old phone (TransferApprovalModal). Flow, all inside one dimmed-scrim
 * card (modelled on AddFriendSheet):
 *
 *   entry   → type the old phone's code → requestTransfer
 *   waiting → show the match code, poll until the old phone approves/declines
 *   moving  → redeem the handover (setSession + restore local state)
 *   done    → onRestored() so the Profile tab reloads as the moved profile
 */
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Keyboard, Modal, Pressable, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Button, Text, TextField, toast} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {
  pollTransferStatus,
  redeemTransfer,
  requestTransfer,
} from '../../core/transfer/transferService';
import {fonts, radii, spacing, useColors, useThemedStyles, type Palette} from '../../theme';

type Props = {
  visible: boolean;
  onCancel: () => void;
  /** Fired once the profile has moved here — the caller reloads its profile. */
  onRestored: () => void;
};

type Phase = 'entry' | 'waiting' | 'moving' | 'done';

const MAX_CODE = 12;
const POLL_MS = 2500;

export function EnterCodeSheet({visible, onCancel, onRestored}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const [phase, setPhase] = useState<Phase>('entry');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [matchCode, setMatchCode] = useState('');

  // Reset to a blank entry every time the sheet (re)opens.
  useEffect(() => {
    if (visible) {
      setPhase('entry');
      setValue('');
      setBusy(false);
      setTransferId(null);
      setMatchCode('');
    }
  }, [visible]);

  const code = value.trim().toUpperCase();

  async function submit() {
    if (code.length === 0 || busy) {
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      const res = await requestTransfer(code);
      if (res.ok) {
        setTransferId(res.transferId);
        setMatchCode(res.matchCode);
        setPhase('waiting');
      } else {
        haptics.error();
        toast.error(
          res.reason === 'not_found'
            ? t('transfer.errorNotFound')
            : res.reason === 'self'
              ? t('transfer.errorSelf')
              : res.reason === 'too_many'
                ? t('transfer.errorTooMany')
                : t('transfer.errorGeneric'),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // While waiting, poll the request until the old phone acts. On approval,
  // redeem the handover and become the moved profile.
  useEffect(() => {
    if (phase !== 'waiting' || !transferId) {
      return;
    }
    let cancelled = false;
    const timer = setInterval(async () => {
      const status = await pollTransferStatus(transferId);
      if (cancelled) {
        return;
      }
      if (status === 'approved') {
        clearInterval(timer);
        setPhase('moving');
        const ok = await redeemTransfer(transferId);
        if (cancelled) {
          return;
        }
        if (ok) {
          haptics.success();
          setPhase('done');
          setTimeout(() => {
            if (!cancelled) {
              onRestored();
            }
          }, 900);
        } else {
          haptics.error();
          toast.error(t('transfer.errorGeneric'));
          setPhase('entry');
        }
      } else if (status === 'denied') {
        clearInterval(timer);
        haptics.error();
        toast.error(t('transfer.errorDenied'));
        setPhase('entry');
      } else if (status === 'gone') {
        clearInterval(timer);
        toast.error(t('transfer.errorExpired'));
        setPhase('entry');
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, transferId, onRestored, t]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={phase === 'entry' ? onCancel : undefined}>
        <Pressable style={styles.card} onPress={Keyboard.dismiss}>
          {phase === 'entry' ? (
            <>
              <Text variant="label" align="center">
                {t('transfer.enterCodeTitle')}
              </Text>
              <Text variant="caption" color="secondary" align="center">
                {t('transfer.enterCodeBody')}
              </Text>
              <TextField
                value={value}
                onChangeText={setValue}
                placeholder={t('transfer.enterCodePlaceholder')}
                autoFocus
                autoCapitalize="characters"
                maxLength={MAX_CODE}
                returnKeyType="done"
                onSubmitEditing={submit}
                accessibilityLabel={t('transfer.enterCodeTitle')}
              />
              <Button
                label={t('transfer.enterCodeConfirm')}
                variant="primary"
                onPress={submit}
                disabled={code.length === 0 || busy}
              />
            </>
          ) : phase === 'waiting' ? (
            <>
              <Text variant="label" align="center">
                {t('transfer.waitingTitle')}
              </Text>
              <Text variant="caption" color="secondary" align="center">
                {t('transfer.waitingBody')}
              </Text>
              <Text style={styles.match} accessibilityLabel={matchCode}>
                {matchCode}
              </Text>
              <ActivityIndicator color={colors.ink} />
              <Text variant="caption" color="tertiary" align="center">
                {t('transfer.waitingHint')}
              </Text>
              <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} />
            </>
          ) : (
            <>
              <Text variant="label" align="center">
                {phase === 'done' ? t('transfer.movedTitle') : t('transfer.movingTitle')}
              </Text>
              {phase === 'done' ? (
                <Text variant="caption" color="secondary" align="center">
                  {t('transfer.movedBody')}
                </Text>
              ) : (
                <ActivityIndicator color={colors.ink} />
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: 'flex-start',
      paddingTop: 150,
      paddingHorizontal: spacing.xl,
    },
    card: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 340,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      alignItems: 'stretch',
      shadowColor: c.shadowInk,
      shadowOpacity: 0.24,
      shadowOffset: {width: 0, height: 16},
      shadowRadius: 32,
      elevation: 12,
    },
    match: {
      fontFamily: fonts.medium,
      fontSize: 28,
      letterSpacing: 6,
      textAlign: 'center',
      color: c.textPrimary,
      paddingVertical: spacing.xs,
    },
  });
