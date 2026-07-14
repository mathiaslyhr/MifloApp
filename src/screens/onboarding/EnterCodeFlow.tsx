/**
 * The "Enter code" flow, launched from the welcome screen's footer link
 * ("Already have a profile?"). Moves an existing profile ONTO this (new) phone;
 * the other half of the handshake lives on the old phone (TransferApprovalModal).
 *
 *   entry   → type the old phone's code → requestTransfer
 *   waiting → show the match code, poll until the old phone approves/declines
 *   moving  → redeem the handover (setSession + restore local state)
 *   done    → onRestored() (closes; AppBody swaps in the app)
 *
 * The full-screen sibling of the old dimmed-modal EnterCodeSheet (still used by
 * ProfileScreen). Onboarding has no navigator, so it's a self-contained
 * component with internal phase state, rendered full-screen over the welcome
 * screen and reached through WelcomeScreen's `codeOpen` flag. It reuses the
 * same transfer services, so nothing new touches the backend.
 */
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Keyboard, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft, ChevronRight} from 'lucide-react-native';
import {Button, PressableScale, Text, TextField, toast} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {
  pollTransferStatus,
  redeemTransfer,
  requestTransfer,
} from '../../core/transfer/transferService';
import {fonts, radii, spacing, useColors, useThemedStyles, type Palette} from '../../theme';

type Phase = 'entry' | 'waiting' | 'moving' | 'done';

const MAX_CODE = 12;
const POLL_MS = 2500;

export function EnterCodeFlow({
  onClose,
  onRestored,
}: {
  /** Abandon → back to the welcome screen. */
  onClose: () => void;
  /** Fired once the profile has moved here — the caller closes the flow. */
  onRestored: () => void;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();

  const [phase, setPhase] = useState<Phase>('entry');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [matchCode, setMatchCode] = useState('');

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

  // Back leaves the flow from entry, and cancels the pending request from
  // waiting; the handover (moving/done) is past the point of no return.
  const canGoBack = phase === 'entry' || phase === 'waiting';

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.container,
          {paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl},
        ]}>
        {/* Top bar: back (hidden once the move is committing). */}
        <View style={styles.topBar}>
          {canGoBack ? (
            <PressableScale
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}>
              <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
            </PressableScale>
          ) : null}
        </View>

        {/* Phase body. */}
        <View style={styles.body}>
          {phase === 'entry' ? (
            // Wrap ONLY the text + field (no buttons) so tapping off the field
            // dismisses the keyboard — the Continue button lives in the footer,
            // so its press-scale gesture isn't stolen (Fabric would kill it).
            <Pressable style={styles.flex} onPress={Keyboard.dismiss} accessible={false}>
              <Text variant="hero">{t('transfer.enterCodeTitle')}</Text>
              <Text variant="secondary" color="secondary" style={styles.subtitle}>
                {t('transfer.enterCodeBody')}
              </Text>
              <TextField
                value={value}
                onChangeText={setValue}
                placeholder={t('transfer.enterCodePlaceholder')}
                autoCapitalize="characters"
                maxLength={MAX_CODE}
                returnKeyType="done"
                onSubmitEditing={submit}
                accessibilityLabel={t('transfer.enterCodeTitle')}
                style={[styles.field, {backgroundColor: colors.surfaceSunken}]}
              />
            </Pressable>
          ) : phase === 'waiting' ? (
            <>
              <Text variant="hero">{t('transfer.waitingTitle')}</Text>
              <Text variant="secondary" color="secondary" style={styles.subtitle}>
                {t('transfer.waitingBody')}
              </Text>
              <View style={styles.codeCard}>
                <Text style={styles.codeText} accessibilityLabel={matchCode}>
                  {matchCode}
                </Text>
              </View>
              <View style={styles.status}>
                <ActivityIndicator color={colors.primary} />
                <Text variant="caption" color="tertiary" align="center" style={styles.hint}>
                  {t('transfer.waitingHint')}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text variant="hero">
                {phase === 'done' ? t('transfer.movedTitle') : t('transfer.movingTitle')}
              </Text>
              {phase === 'done' ? (
                <Text variant="secondary" color="secondary" style={styles.subtitle}>
                  {t('transfer.movedBody')}
                </Text>
              ) : (
                <View style={styles.status}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            </>
          )}
        </View>

        {/* Footer actions. */}
        <View style={styles.footer}>
          {phase === 'entry' ? (
            <Button
              label={t('transfer.enterCodeConfirm')}
              variant="primary"
              onPress={submit}
              disabled={code.length === 0 || busy}
              trailingIcon={<ChevronRight size={20} color={colors.onInk} strokeWidth={2.25} />}
            />
          ) : phase === 'waiting' ? (
            <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: c.background},
    flex: {flex: 1},
    container: {flex: 1, paddingHorizontal: spacing.xl},
    topBar: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 24},
    body: {flex: 1, marginTop: spacing.xxl},
    subtitle: {marginTop: spacing.sm},
    field: {marginTop: spacing.xl},
    // Card: sunken fill + hairline divider border.
    codeCard: {
      marginTop: spacing.xl,
      alignItems: 'center',
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: radii.card,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    codeText: {
      fontFamily: fonts.medium,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: 6,
      textAlign: 'center',
      color: c.textPrimary,
    },
    status: {marginTop: spacing.xxl, alignItems: 'center', gap: spacing.md},
    hint: {maxWidth: 260},
    footer: {gap: spacing.md, alignItems: 'stretch'},
  });
