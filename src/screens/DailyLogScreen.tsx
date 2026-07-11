/**
 * Log — the tab-page archive for the four daily games. A streak card up top
 * (2×2, one cell per game), then one glass card per day (today first) with a
 * DailyChip per game: greyed out when not started, an eye with the running
 * tries while ongoing, a green check when solved, a red cross when
 * surrendered. Finished days also show the answer (the player/team/list) —
 * that's the owner's privilege; the published copies friends see never carry
 * answers.
 *
 * Lives in the tab shell like Home/Games/Friends: the wordmark header scrolls
 * away, the shared nav island floats over the bottom. The page stays mounted
 * across tab switches, so `isActive` is its focus signal (mirrors SocialScreen),
 * used to reload so finishing a game and coming back updates today's card.
 */
import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {GlassCard, NAV_HEIGHT, Screen, Text, TopStatusFade} from '../core/ui';
import {colors, fonts, screenPadding, spacing} from '../theme';
import {dateKeyFor, previousDateKey} from '../games/scout/dailySeed';
import {DailyChip, GAME_META} from '../core/daily/DailyChip';
import {dailyAnswerFor} from '../core/daily/answers';
import {
  DAILY_GAMES,
  loadDailyLog,
  type DailyLog,
} from '../core/daily/dailyLog';

type Props = {
  isActive: boolean;
};

export function DailyLogScreen({isActive}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  // Log + the day it was loaded for, together, so a load finishing just after
  // midnight can't label the wrong row "Today".
  const [state, setState] = useState<{log: DailyLog; todayKey: string} | null>(
    null,
  );

  // Reload every time the tab becomes active, so finishing a game and coming
  // back flips today's chips.
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const todayKey = dateKeyFor(new Date());
    let live = true;
    loadDailyLog(todayKey).then(log => {
      if (live) {
        setState({log, todayKey});
      }
    });
    return () => {
      live = false;
    };
  }, [isActive]);

  const months = t('dailyLog.months', {returnObjects: true}) as string[];

  function formatDay(dateKey: string, todayKey: string): string {
    if (dateKey === todayKey) {
      return t('dailyLog.today');
    }
    if (dateKey === previousDateKey(todayKey)) {
      return t('dailyLog.yesterday');
    }
    const [, m, d] = dateKey.split('-').map(Number);
    return `${d} ${months[m - 1] ?? m}`;
  }

  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away) and the shell nav owns the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('dailyLog.title')}
          </Text>
        </View>

        {state ? (
          <>
            {/* Streaks — a 2×2 grid so every game keeps its full name. */}
            <View style={styles.section}>
              <Text variant="caption" color="tertiary" style={styles.eyebrow}>
                {t('dailyLog.streaks').toUpperCase()}
              </Text>
              <GlassCard style={styles.streakCard}>
                {DAILY_GAMES.map(game => (
                  <View key={game} style={styles.streakCell}>
                    <Text variant="secondary" color="secondary" numberOfLines={1}>
                      {t(GAME_META[game].titleKey)}
                    </Text>
                    <Text style={styles.streakValue}>
                      {state.log.streaks[game].current}
                    </Text>
                    <Text variant="caption" color="tertiary" numberOfLines={1}>
                      {t('dailyLog.best', {count: state.log.streaks[game].best})}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            </View>

            {/* The history — one card per day, today first. Finished chips
                carry the answer: my own log may show it, published results
                never do. */}
            <View style={styles.section}>
              <Text variant="caption" color="tertiary" style={styles.eyebrow}>
                {t('dailyLog.history').toUpperCase()}
              </Text>
              <View style={styles.dayList}>
                {state.log.days.map(day => (
                  <GlassCard key={day.dateKey} style={styles.dayCard}>
                    <Text variant="label">
                      {formatDay(day.dateKey, state.todayKey)}
                    </Text>
                    <View style={styles.chipGrid}>
                      {DAILY_GAMES.map(game => {
                        const cell = day.cells[game];
                        const finished =
                          cell.status === 'won' || cell.status === 'revealed';
                        return (
                          <DailyChip
                            key={game}
                            game={game}
                            status={cell.status}
                            count={cell.count}
                            answer={
                              finished
                                ? dailyAnswerFor(game, day.dateKey, cell.refId, t)
                                : null
                            }
                          />
                        );
                      })}
                    </View>
                  </GlassCard>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Seamless frosted fade behind the status bar — content dissolves under
          it (no hard edge) as it scrolls up. */}
      <TopStatusFade />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  list: {
    paddingHorizontal: screenPadding,
    gap: spacing.lg,
  },
  section: {gap: spacing.sm},
  // Mirrors MenuGroup's eyebrow so the log reads like the other grouped pages.
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
  dayList: {gap: spacing.md},
  dayCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
