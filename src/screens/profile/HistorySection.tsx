/**
 * The daily-games history from the old Log tab, shared by both profile pages:
 * one card per day (today first), a DailyRow per game inside. Hosts
 * prepare the rows — the own page resolves answers locally (owner's
 * privilege), a friend's page always passes null answers (published rows
 * can't carry any) — so the no-spoiler rule holds by construction.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Card, Text} from '../../core/ui';
import {spacing} from '../../theme';
import {DailyRow} from '../../core/daily/DailyRow';
import {useDayLabel} from './dayLabel';
import type {DailyGame, DayCellStatus} from '../../core/daily/dailyLog';

export type HistoryDay = {
  dateKey: string;
  rows: {
    game: DailyGame;
    status: DayCellStatus;
    right: number | null;
    wrong: number | null;
    answer: string | null;
  }[];
};

type Props = {
  /** Newest first — today's card leads. */
  days: HistoryDay[];
  todayKey: string;
  /** Shown instead of day cards when there's no history (friend pages). */
  emptyLabel?: string;
};

export function HistorySection({days, todayKey, emptyLabel}: Props) {
  const {t} = useTranslation();
  const formatDay = useDayLabel(todayKey);

  return (
    <View style={styles.section}>
      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t('dailyLog.history').toUpperCase()}
      </Text>
      {days.length === 0 && emptyLabel ? (
        <Card style={styles.messageCard}>
          <Text variant="secondary" color="secondary" align="center">
            {emptyLabel}
          </Text>
        </Card>
      ) : (
        <View style={styles.dayList}>
          {days.map(day => (
            <Card key={day.dateKey} style={styles.dayCard}>
              <Text variant="label">{formatDay(day.dateKey)}</Text>
              {/* Full-width rows, not pills: the game name and the answer get
                  the card's whole width. */}
              <View>
                {day.rows.map((row, i) => (
                  <DailyRow
                    key={row.game}
                    game={row.game}
                    status={row.status}
                    right={row.right}
                    wrong={row.wrong}
                    answer={row.answer}
                    isLast={i === day.rows.length - 1}
                  />
                ))}
              </View>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {gap: spacing.sm},
  eyebrow: {
    letterSpacing: 1,
    marginLeft: spacing.md,
  },
  dayList: {gap: spacing.md},
  dayCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  messageCard: {padding: spacing.xl},
});
