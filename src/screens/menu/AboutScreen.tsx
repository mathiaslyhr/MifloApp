import React from 'react';
import {StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Text} from '../../core/ui';
import {spacing} from '../../theme';
import {APP_VERSION} from '../../core/config';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

/** About Miflo — a short blurb and the running version. */
export function AboutScreen({navigation}: Props) {
  const {t} = useTranslation();
  return (
    <MenuDetailScreen
      title={t('aboutPage.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <Text variant="body" color="secondary">
        {t('aboutPage.blurb')}
      </Text>
      <Text variant="caption" color="muted">
        {t('aboutPage.version', {version: APP_VERSION})}
      </Text>
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.lg},
});
