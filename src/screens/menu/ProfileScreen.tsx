import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {MenuGroup, Text} from '../../core/ui';
import {spacing} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

/**
 * Profile — a container for the player's sections. For now it holds a single
 * "Stats" section (coming soon), grouped the same way Settings groups Language.
 */
export function ProfileScreen({navigation}: Props) {
  const {t} = useTranslation();
  return (
    <MenuDetailScreen
      title={t('menu.profile')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <MenuGroup label={t('stats.title')}>
        <View style={styles.section}>
          <Text variant="body">{t('stats.comingSoon')}</Text>
          <Text variant="secondary" color="secondary">
            {t('stats.comingSoonDesc')}
          </Text>
        </View>
      </MenuGroup>
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.xl},
  section: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
});
