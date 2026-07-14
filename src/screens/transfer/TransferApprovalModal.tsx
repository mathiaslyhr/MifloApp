/**
 * The old phone's side of a move: a global modal that pops (wherever the owner
 * is) when their new phone asks to take the profile. Approving here is the
 * security gate — a public friend code can start a request, but only a tap on
 * the device that owns the session can hand it over. The match code is shown so
 * the owner can confirm the request is really from the phone in their hand.
 *
 * Mounted once near ToastHost in App.tsx; driven by useTransferStore, which is
 * polled by startTransferWatch.
 */
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Modal, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Button, Text} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {navigationRef} from '../../core/navigation/navigationRef';
import {useTransferStore} from '../../core/transfer/transferStore';
import {
  approveTransfer,
  awaitRelinquish,
  denyTransfer,
  type PendingTransfer,
} from '../../core/transfer/transferService';
import {fonts, radii, spacing, useColors, useThemedStyles, type Palette} from '../../theme';

type Phase = 'idle' | 'prompt' | 'approving' | 'waiting' | 'done' | 'error';

export function TransferApprovalModal() {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const pending = useTransferStore(s => s.pending);
  const markHandled = useTransferStore(s => s.markHandled);

  const [active, setActive] = useState<PendingTransfer | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Adopt a new request only while idle/prompting; once the owner acts we drive
  // the flow from `active` and ignore the store (whose row leaves 'pending').
  useEffect(() => {
    if (phase === 'idle' || phase === 'prompt') {
      if (pending && pending.id !== active?.id) {
        setActive(pending);
        setPhase('prompt');
      } else if (!pending && phase === 'prompt') {
        setActive(null);
        setPhase('idle');
      }
    }
  }, [pending, active?.id, phase]);

  function close() {
    setPhase('idle');
    setActive(null);
  }

  async function onApprove() {
    if (!active) {
      return;
    }
    const id = active.id;
    markHandled(id); // stop the poller from fighting the flow
    setPhase('approving');
    const ok = await approveTransfer(id);
    if (!ok) {
      haptics.error();
      setPhase('error');
      return;
    }
    setPhase('waiting');
    const relinquished = await awaitRelinquish(id);
    if (relinquished) {
      haptics.success();
      setPhase('done');
    } else {
      // The new phone never finished (expired/declined its end). This phone
      // kept its session, so just close — nothing was lost.
      close();
    }
  }

  async function onDecline() {
    if (!active) {
      return;
    }
    markHandled(active.id);
    denyTransfer(active.id);
    close();
  }

  function onDone() {
    // Local data was wiped and the session signed out; return to a fresh start.
    if (navigationRef.isReady()) {
      navigationRef.reset({index: 0, routes: [{name: 'Tabs'}]});
    }
    close();
  }

  const visible = phase !== 'idle' && active !== null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.scrim}>
        <View style={styles.card}>
          {phase === 'prompt' ? (
            <>
              <Text variant="label" align="center">
                {t('transfer.approveTitle')}
              </Text>
              <Text variant="caption" color="secondary" align="center">
                {t('transfer.approveBody')}
              </Text>
              <Text variant="caption" color="tertiary" align="center">
                {t('transfer.approveMatch')}
              </Text>
              <Text style={styles.match} accessibilityLabel={active?.matchCode}>
                {active?.matchCode}
              </Text>
              <Button
                label={t('transfer.approveConfirm')}
                variant="primary"
                onPress={onApprove}
              />
              <Button
                label={t('transfer.approveDecline')}
                variant="secondary"
                onPress={onDecline}
              />
            </>
          ) : phase === 'approving' || phase === 'waiting' ? (
            <>
              <Text variant="label" align="center">
                {t('transfer.approveTitle')}
              </Text>
              <Text variant="caption" color="secondary" align="center">
                {t('transfer.approveWaiting')}
              </Text>
              <ActivityIndicator color={colors.ink} />
            </>
          ) : phase === 'done' ? (
            <>
              <Text variant="label" align="center">
                {t('transfer.approveDoneTitle')}
              </Text>
              <Text variant="caption" color="secondary" align="center">
                {t('transfer.approveDoneBody')}
              </Text>
              <Button label={t('common.close')} variant="primary" onPress={onDone} />
            </>
          ) : (
            <>
              <Text variant="label" align="center">
                {t('transfer.approveTitle')}
              </Text>
              <Text variant="caption" color="secondary" align="center">
                {t('transfer.approveError')}
              </Text>
              <Button label={t('common.close')} variant="secondary" onPress={close} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 340,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
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
      color: c.ink,
      paddingVertical: spacing.xs,
    },
  });
