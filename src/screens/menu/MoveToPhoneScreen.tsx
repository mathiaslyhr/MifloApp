import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Card, Text} from '../../core/ui';
import {spacing, useThemedStyles, type Palette} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MoveToPhone'>;

/**
 * Move to a new phone — explains the device-linking flow. Miflo has no account,
 * so the profile is carried across by entering this phone's code on the new one
 * and approving here. Reached from the Menu's profile group; the approval itself
 * pops as a global modal, not from this page.
 */
export function MoveToPhoneScreen({navigation}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const steps = [1, 2, 3].map(n => ({
    n,
    title: t(`transfer.step${n}Title`),
    desc: t(`transfer.step${n}Desc`),
  }));

  return (
    <MenuDetailScreen
      title={t('transfer.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <Text variant="secondary" color="secondary">
        {t('transfer.intro')}
      </Text>

      {steps.map(s => (
        <View key={s.n} style={styles.step}>
          <Card radius="pill" style={styles.badge}>
            <Text variant="label" style={styles.badgeText}>
              {s.n}
            </Text>
          </Card>
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.xl},
    step: {flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start'},
    badge: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    badgeText: {lineHeight: 20, color: c.ink},
    stepText: {flex: 1, gap: spacing.xs},
  });
