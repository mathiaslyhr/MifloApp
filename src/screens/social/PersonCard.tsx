/**
 * One friend's day on the Friends tab: name row (avatar, presence, streak)
 * plus the four full-width DailyRows the Log tab also uses, so a friend's
 * card mirrors your own log. (A 7-day dot strip lived here once — removed
 * 2026-07-11, the counts were unreadable at that size. A "You" card shared
 * this component too until the identity moved to the Profile tab.)
 */
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {Flame} from 'lucide-react-native';
import {Avatar, GlassCard, Text, initialsFor} from '../../core/ui';
import {colors, spacing} from '../../theme';
import {DAILY_GAMES, type DailyGame, type DayCellStatus} from '../../core/daily/dailyLog';
import {DailyRow} from '../../core/daily/DailyRow';
import {MAX_ACTIVE_AGE_MIN, type Presence} from '../../core/social/presence';
import type {PublishedResult} from '../../core/social/types';

/** What one row on a person card shows — a friend's published state, or my
 * local state (only mine may carry an answer; published rows never do). */
export type ChipCell = {status: DayCellStatus; count: number | null; answer: string | null};

/** A friend's today cells from their published rows — status + tries only,
 * never an answer (the wire cannot carry one). */
export function friendCellsFor(
  results: PublishedResult[],
  todayKey: string,
): Map<DailyGame, ChipCell> {
  const map = new Map<DailyGame, ChipCell>();
  for (const r of results) {
    if (r.dateKey === todayKey) {
      map.set(r.game, {status: r.status, count: r.score, answer: null});
    }
  }
  return map;
}

/** A friend's best live streak — only today's rows are trusted for streaks. */
export function friendStreak(results: PublishedResult[], todayKey: string): number {
  let best = 0;
  for (const r of results) {
    if (r.dateKey === todayKey && r.streak > best) {
      best = r.streak;
    }
  }
  return best;
}

/** "Active 14 min ago" caption; nothing when online (the dot), after 7 days, or unknown. */
export function formatLastActive(presence: Presence, t: TFunction): string | null {
  const m = presence.minutesAgo;
  if (presence.online || m === null || m > MAX_ACTIVE_AGE_MIN) {
    return null;
  }
  if (m < 60) {
    return t('social.activeMinutes', {count: m});
  }
  if (m < 24 * 60) {
    return t('social.activeHours', {count: Math.floor(m / 60)});
  }
  return t('social.activeDays', {count: Math.floor(m / (24 * 60))});
}

type Props = {
  name: string;
  streak: number;
  today: Map<DailyGame, ChipCell>;
  presence?: Presence;
  /** Tap opens the friend's profile page. */
  onPress?: () => void;
};

export function PersonCard({name, streak, today, presence, onPress}: Props) {
  const {t} = useTranslation();
  const initials = initialsFor(name);
  const activeLabel = presence ? formatLastActive(presence, t) : null;
  const card = (
    <GlassCard style={styles.personCard}>
      <View style={styles.personRow}>
        <View>
          <Avatar initials={initials} tone="soft" />
          {presence?.online ? (
            <View style={styles.onlineDot} accessibilityLabel={t('social.a11yOnline')} />
          ) : null}
        </View>
        <View style={styles.personName}>
          <Text variant="label" numberOfLines={1}>
            {name}
          </Text>
          {activeLabel ? (
            <Text variant="caption" color="tertiary" numberOfLines={1}>
              {activeLabel}
            </Text>
          ) : null}
        </View>
        {streak > 1 ? (
          <View style={styles.streak} accessibilityLabel={t('social.a11yStreak', {count: streak})}>
            <Flame size={14} color={colors.primary} strokeWidth={2} />
            <Text variant="caption" color="secondary">
              {streak}
            </Text>
          </View>
        ) : null}
      </View>
      {/* Full-width game rows — the same list the Log tab's day cards use,
          so a friend's card mirrors your own. */}
      <View>
        {DAILY_GAMES.map((game, i) => {
          const cell = today.get(game);
          return (
            <DailyRow
              key={game}
              game={game}
              status={cell?.status ?? 'notPlayed'}
              count={cell?.count ?? null}
              answer={cell?.answer ?? null}
              isLast={i === DAILY_GAMES.length - 1}
            />
          );
        })}
      </View>
    </GlassCard>
  );
  if (!onPress) {
    return card;
  }
  // The whole card is the tap target — it opens the friend's profile page,
  // where invite and remove live (Instagram model, no hidden gestures).
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  personCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personName: {flex: 1},
  // Instagram-style presence: a small green disc pinned to the avatar's
  // corner, rimmed in surface white so it reads on the glass card.
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
