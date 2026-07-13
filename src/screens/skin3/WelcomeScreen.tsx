/**
 * Skin 3 — screen 1: the welcome screen. Skin 3 is the ground-up redesign, so
 * the app starts here as its front door; every other screen gets rebuilt onto
 * this new look one at a time.
 *
 * Layout follows a landing-page shape: the shared purple glow at the top of a
 * near-black canvas (GlowBackground), then a bottom-anchored block — MifloBall
 * wordmark, a hero tagline, a subtitle, the primary "Quick setup" CTA, and an
 * "Enter code" link for people who already made a profile (moving to a new phone).
 *
 *   Quick setup → QuickSetupFlow (multi-step: name → code → favorites)
 *   Enter code  → EnterCodeSheet (move a profile onto this phone)
 * Both work without a navigator (skin 3 renders outside NavigationContainer).
 * The wordmark long-press opens a skin picker (temporary A/B dev affordance).
 */
import React, {useState} from 'react';
import {ActionSheetIOS, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronRight} from 'lucide-react-native';
import {Button, Text} from '../../core/ui';
import {EnterCodeSheet} from '../transfer/EnterCodeSheet';
import {spacing, useColors, useSkin, useThemedStyles, type Palette} from '../../theme';
import {GlowBackground} from './GlowBackground';
import {QuickSetupFlow} from './setup/QuickSetupFlow';

export function WelcomeScreen(): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {setPreference} = useSkin();
  const {t} = useTranslation();

  const [setupActive, setSetupActive] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  const switchSkin = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {title: 'Switch skin', options: ['Skin 3', 'Light', 'Dark', 'Cancel'], cancelButtonIndex: 3},
      index => {
        const pick = index === 0 ? 'skin3' : index === 1 ? 'light' : index === 2 ? 'dark' : null;
        if (pick) {
          setPreference(pick).catch(() => {});
        }
      },
    );
  };

  return (
    <>
      <GlowBackground>
        <View
          style={[
            styles.body,
            {paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl},
          ]}>
          {/* Group 1 — the wordmark, on its own. */}
          <Pressable onLongPress={switchSkin} delayLongPress={600} accessibilityRole="header">
            <Text variant="wordmark">MifloBall</Text>
          </Pressable>

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

        <EnterCodeSheet
          visible={codeOpen}
          onCancel={() => setCodeOpen(false)}
          onRestored={() => setCodeOpen(false)}
        />
      </GlowBackground>

      {setupActive ? (
        <View style={StyleSheet.absoluteFill}>
          <QuickSetupFlow
            onClose={() => setSetupActive(false)}
            onComplete={() => setSetupActive(false)}
          />
        </View>
      ) : null}
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
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
