import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Card, Text} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {GAMES} from '../gamesCatalog';
import {MenuDetailScreen} from './MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'HowToPlay'>;

/** How to play — the rules, also reached from the Home "?" help button. */
export function HowToPlayScreen({navigation}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  // Getting-started steps (the party flow); per-game rules follow below.
  const steps = [1, 2].map(n => ({
    n,
    title: t(`howToPlay.step${n}Title`),
    desc: t(`howToPlay.step${n}Desc`),
  }));

  // One rules section per built game, driven off the games catalog.
  const games = GAMES.filter(g => g.available).map(g => ({
    key: g.gameType,
    Icon: g.Icon,
    title: t(`games.${g.i18nKey}.title`),
    rules: t(`games.${g.i18nKey}.howToPlay.rules`, {
      returnObjects: true,
    }) as string[],
  }));

  return (
    <MenuDetailScreen
      title={t('howToPlay.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <Text variant="secondary" color="secondary">
        {t('howToPlay.intro')}
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

      <Text variant="label" color="secondary">
        {t('howToPlay.gamesHeading')}
      </Text>

      {games.map(g => (
        <View key={g.key} style={styles.game}>
          <View style={styles.gameHeader}>
            <Card radius="pill" style={styles.badge}>
              <g.Icon size={18} color={colors.ink} strokeWidth={1.75} />
            </Card>
            <Text variant="body">{g.title}</Text>
          </View>
          <View style={styles.rules}>
            {g.rules.map((rule, i) => (
              <Text key={i} variant="secondary" color="secondary">
                {rule}
              </Text>
            ))}
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
    // Surface chip (Card) holding a step number or game icon.
    badge: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      // Nudge down so the number sits level with the step title's cap height.
      marginTop: 2,
    },
    badgeText: {lineHeight: 20, color: c.ink},
    stepText: {flex: 1, gap: spacing.xs},
    game: {gap: spacing.md},
    gameHeader: {flexDirection: 'row', gap: spacing.md, alignItems: 'center'},
    rules: {gap: spacing.xs, paddingLeft: 30 + spacing.md},
  });
