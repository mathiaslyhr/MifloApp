/**
 * MysteryHistoryModal — the "past puzzles" archive behind the history button.
 * Past answers are free (re-derived from the daily seed for each earlier date);
 * the user's own result per day comes from the persisted [[HistoryLog]]. Shows a
 * rolling window of recent days, most recent first.
 */
import React, {useMemo} from 'react';
import {Image, Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {colors, fonts, radii, spacing} from '../../theme';
import {flagImage} from '../tic-tac-toe/criterionIcon';
import {dailyPool, pastDateKeys, secretFor} from './dailySeed';
import type {HistoryLog} from './types';

/** How many past days the archive shows. */
const WINDOW = 14;

type Props = {
  visible: boolean;
  onClose: () => void;
  todayKey: string;
  history: HistoryLog;
};

export function MysteryHistoryModal({visible, onClose, todayKey, history}: Props) {
  const {t} = useTranslation();
  const months = t('mystery.history.months', {returnObjects: true}) as string[];
  const pool = useMemo(() => dailyPool(), []);
  const days = useMemo(() => pastDateKeys(todayKey, WINDOW), [todayKey]);

  function formatDay(dateKey: string): string {
    const [, m, d] = dateKey.split('-').map(Number);
    return `${d} ${months[m - 1] ?? m}`;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="label" align="center">
            {t('mystery.history.title')}
          </Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {days.map(dateKey => {
              const secret = secretFor(dateKey, pool);
              const result = history[dateKey];
              const flag = flagImage(secret.nationality[0]);
              return (
                <View key={dateKey} style={styles.row}>
                  <Text style={styles.date}>{formatDay(dateKey)}</Text>
                  {flag != null ? (
                    <Image source={flag} resizeMode="contain" style={styles.flag} />
                  ) : null}
                  <Text variant="body" numberOfLines={1} style={styles.name}>
                    {secret.name}
                  </Text>
                  {result ? (
                    <Text
                      style={[
                        styles.result,
                        {color: result.status === 'won' ? colors.success : colors.error},
                      ]}>
                      {result.status === 'won' ? `${result.guessCount}/6` : 'X/6'}
                    </Text>
                  ) : (
                    <Text style={[styles.result, styles.notPlayed]}>
                      {t('mystery.history.notPlayed')}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13,13,22,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  list: {maxHeight: 420},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  date: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
    width: 48,
  },
  flag: {width: 20, height: 14, borderRadius: 2},
  name: {flex: 1},
  result: {
    fontFamily: fonts.medium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  notPlayed: {color: colors.textTertiary},
});
