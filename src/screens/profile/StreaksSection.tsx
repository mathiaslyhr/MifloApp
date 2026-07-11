/**
 * The streak grid from the old Log tab, now shared by both profile pages: a
 * 2×2 glass card, one cell per daily game, so every game keeps its full name.
 * The own page shows current + best; a friend's page passes no `best` (only
 * today's published streak is ever trusted) and the caption disappears.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {GlassCard, Text} from '../../core/ui';
import {colors, fonts, spacing} from '../../theme';
import {GAME_META} from '../../core/daily/DailyRow';
import type {DailyGame} from '../../core/daily/dailyLog';

export type StreakCell = {
  game: DailyGame;
  current: number;
  /** Omit on friend pages — published rows never carry a "best". */
  best?: number;
};

export function StreaksSection({cells}: {cells: StreakCell[]}) {
  const {t} = useTranslation();
  return (
    <View style={styles.section}>
      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t('dailyLog.streaks').toUpperCase()}
      </Text>
      <GlassCard style={styles.streakCard}>
        {cells.map(cell => (
          <View key={cell.game} style={styles.streakCell}>
            <Text variant="secondary" color="secondary" numberOfLines={1}>
              {t(GAME_META[cell.game].titleKey)}
            </Text>
            <Text style={styles.streakValue}>{cell.current}</Text>
            {cell.best !== undefined ? (
              <Text variant="caption" color="tertiary" numberOfLines={1}>
                {t('dailyLog.best', {count: cell.best})}
              </Text>
            ) : null}
          </View>
        ))}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {gap: spacing.sm},
  // Mirrors MenuGroup's eyebrow so the page reads like the other grouped ones.
  eyebrow: {
    letterSpacing: 1,
    marginLeft: spacing.md,
  },
  streakCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.md,
  },
  // Half-width cells → a 2×2 grid; every game name fits in full.
  streakCell: {
    flexBasis: '50%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Matches the games' result-screen Stat value (medium 20, the scale's cap).
  streakValue: {
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 24,
    color: colors.ink,
  },
});
