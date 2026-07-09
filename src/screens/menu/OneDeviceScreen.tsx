import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {GlassCard, Text} from '../../core/ui';
import {colors, spacing} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'OneDevice'>;

/**
 * One device — explains pass-and-play: some games work on a single shared
 * phone with no internet (the swipe-right gesture is invisible on its own, so
 * this page is its signpost). Reached from the phone button on the Games hub
 * and from the Menu's About group.
 */
export function OneDeviceScreen({navigation}: Props) {
  const {t} = useTranslation();

  const steps = [1, 2, 3].map(n => ({
    n,
    title: t(`oneDevice.step${n}Title`),
    desc: t(`oneDevice.step${n}Desc`),
  }));

  return (
    <MenuDetailScreen
      title={t('oneDevice.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <Text variant="secondary" color="secondary">
        {t('oneDevice.intro')}
      </Text>

      {steps.map(s => (
        <View key={s.n} style={styles.step}>
          <GlassCard radius="pill" tint="light" style={styles.badge}>
            <Text variant="label" style={styles.badgeText}>
              {s.n}
            </Text>
          </GlassCard>
          <View style={styles.stepText}>
            <Text variant="body">{s.title}</Text>
            <Text variant="secondary" color="secondary">
              {s.desc}
            </Text>
          </View>
        </View>
      ))}
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.xl},
  step: {flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start'},
  // Frosted "liquid glass" chip (GlassCard) holding the step number.
  badge: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudge down so the number sits level with the step title's cap height.
    marginTop: 2,
  },
  badgeText: {lineHeight: 20, color: colors.ink},
  stepText: {flex: 1, gap: spacing.xs},
});
