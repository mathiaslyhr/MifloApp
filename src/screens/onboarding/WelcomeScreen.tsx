/**
 * The welcome screen — the app's front door on a fresh install.
 *
 * Layout follows a landing-page shape: a bottom-anchored block with the
 * MifloBall wordmark, a hero tagline, a subtitle, the primary "Quick setup"
 * CTA, and an "Enter code" link for people who already made a profile
 * (moving to a new phone).
 *
 *   Quick setup → QuickSetupFlow (multi-step: name → code → favorites)
 *   Enter code  → EnterCodeFlow (move a profile onto this phone)
 * Both work without a navigator (this renders outside NavigationContainer).
 */
import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronRight} from 'lucide-react-native';
import {Button, Text} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {EnterCodeFlow} from './EnterCodeFlow';
import {QuickSetupFlow} from './setup/QuickSetupFlow';

export function WelcomeScreen({
  onProfileReady,
}: {
  /** A profile now exists on this device (setup finished, or a move landed) —
   * AppBody re-checks the gate and swaps the welcome overlay for the app. */
  onProfileReady?: () => void;
} = {}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();

  const [setupActive, setSetupActive] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  return (
    <>
      <View style={styles.canvas}>
        <View
          style={[
            styles.body,
            {paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl},
          ]}>
          {/* Group 1 — the wordmark, on its own. */}
          <Text variant="wordmark" accessibilityRole="header">
            MifloBall
          </Text>

          {/* Group 2 — tagline + subtitle, tight together. */}
          <Text variant="hero" style={styles.groupGap}>
            {t('welcome.tagline')}
          </Text>
          <Text variant="secondary" color="secondary" style={styles.subtitle}>
            {t('welcome.subtitle')}
          </Text>

          {/* Group 3 — the CTA + its footer link, tight together. */}
          <Button
            label={t('welcome.quickSetup')}
            variant="primary"
            onPress={() => setSetupActive(true)}
            trailingIcon={<ChevronRight size={20} color={colors.onInk} strokeWidth={2.25} />}
            style={styles.groupGap}
          />
          <View style={styles.footer}>
            <Text variant="secondary" color="secondary">
              {t('welcome.haveProfile')}{' '}
            </Text>
            <Pressable onPress={() => setCodeOpen(true)} hitSlop={8} accessibilityRole="button">
              <Text variant="secondary" color="accent">
                {t('welcome.enterCode')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {setupActive ? (
        <View style={StyleSheet.absoluteFill}>
          <QuickSetupFlow
            onClose={() => setSetupActive(false)}
            onComplete={() => {
              setSetupActive(false);
              onProfileReady?.();
            }}
          />
        </View>
      ) : null}

      {codeOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <EnterCodeFlow
            onClose={() => setCodeOpen(false)}
            onRestored={() => {
              setCodeOpen(false);
              onProfileReady?.();
            }}
          />
        </View>
      ) : null}
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    canvas: {flex: 1, backgroundColor: c.background},
    body: {flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl},
    // Big gap = a new group (wordmark → text, text → CTA). Small gaps below
    // keep each group's own members tight so the three read as three.
    groupGap: {marginTop: spacing.xxl},
    subtitle: {marginTop: spacing.sm},
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
  });
