/**
 * MysteryHistoryModal — the "past puzzles" archive behind the history button.
 * Deliberately shows only the date and whether the user played that day (no
 * answer, no score), so it never spoils a past secret. Most recent day first.
 */
import React, {useMemo} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {colors, fonts, radii, spacing} from '../../theme';
import {pastDateKeys} from './dailySeed';
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
              const played = history[dateKey] !== undefined;
              return (
                <View key={dateKey} style={styles.row}>
                  <Text style={styles.date}>{formatDay(dateKey)}</Text>
                  <Text style={[styles.status, played ? styles.played : styles.notPlayed]}>
                    {played ? t('mystery.history.played') : t('mystery.history.notPlayed')}
                  </Text>
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
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  date: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  status: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  played: {color: colors.ink},
  notPlayed: {color: colors.textTertiary},
});
