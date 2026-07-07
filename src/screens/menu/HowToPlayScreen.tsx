import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Text} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'HowToPlay'>;

/** How to play — the rules, also reached from the Home "?" help button. */
export function HowToPlayScreen({navigation}: Props) {
  const {t} = useTranslation();

  const steps = [1, 2, 3, 4].map(n => ({
    n,
    title: t(`howToPlay.step${n}Title`),
    desc: t(`howToPlay.step${n}Desc`),
  }));

  return (
    <MenuDetailScreen
      title={t('howToPlay.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <Text variant="body" color="secondary">
        {t('howToPlay.intro')}
      </Text>
      {steps.map(s => (
        <View key={s.n} style={styles.step}>
          <View style={styles.badge}>
            <Text variant="label" style={styles.badgeText}>
              {s.n}
            </Text>
          </View>
          <View style={styles.stepText}>
            <Text variant="section">{s.title}</Text>
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
  // Frosted "liquid glass" number chip — same language as CircleButton / the
  // nav island, not a solid purple fill.
  badge: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.glassRim,
    alignItems: 'center',
    justifyContent: 'center',
    // Soft lift for the glass depth.
    shadowColor: '#140F32',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 4,
    // Nudge down so the number sits level with the step title's cap height.
    marginTop: 2,
  },
  badgeText: {lineHeight: 20, color: colors.ink},
  stepText: {flex: 1, gap: spacing.xs},
});
