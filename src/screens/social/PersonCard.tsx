/**
 * One friend's day on the Friends tab: name row (avatar, presence, streak)
 * plus the four full-width DailyRows the Log tab also uses, so a friend's
 * card mirrors your own log. (A 7-day dot strip lived here once — removed
 * 2026-07-11, the counts were unreadable at that size. A "You" card shared
 * this component too until the identity moved to the Profile tab.)
 */
import React, {useRef, useState} from 'react';
import {Animated, LayoutAnimation, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {ChevronDown, Flame} from 'lucide-react-native';
import {Avatar, GlassCard, Text, initialsFor} from '../../core/ui';
import {colors, spacing} from '../../theme';
import {DAILY_GAMES, type DailyGame, type DayCellStatus} from '../../core/daily/dailyLog';
import {DailyRow} from '../../core/daily/DailyRow';
import {MAX_ACTIVE_AGE_MIN, type Presence} from '../../core/social/presence';
import type {PublishedResult} from '../../core/social/types';

/** What one row on a person card shows — a friend's published state, or my
 * local state (only mine may carry an answer; published rows never do). */
export type ChipCell = {
  status: DayCellStatus;
  right: number | null;
  wrong: number | null;
  answer: string | null;
};

/** A friend's today cells from their published rows — status + right/wrong
 * counts only, never an answer (the wire cannot carry one). The wire carries
 * wrong in `score`, right in `total` (null on pre-right-count rows → 0). */
export function friendCellsFor(
  results: PublishedResult[],
  todayKey: string,
): Map<DailyGame, ChipCell> {
  const map = new Map<DailyGame, ChipCell>();
  for (const r of results) {
    if (r.dateKey === todayKey) {
      map.set(r.game, {status: r.status, right: r.total ?? 0, wrong: r.score, answer: null});
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

/** "Active 14 min ago" caption; nothing when online (the dot) or unknown. Beyond
 * two weeks the number stops climbing — it freezes at "Active 14 days ago". */
export function formatLastActive(presence: Presence, t: TFunction): string | null {
  if (presence.online || presence.minutesAgo === null) {
    return null;
  }
  const m = Math.min(presence.minutesAgo, MAX_ACTIVE_AGE_MIN);
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
  /** The friend's profile picture URL, or null for the initials fallback. */
  avatarUri?: string | null;
  /** Tap opens the friend's profile page. */
  onPress?: () => void;
};

/** The avatar and name open the friend's profile; a plain View when there's
 * nowhere to go (so it never swallows the row's fold tap). */
function ProfileTarget({
  onPress,
  label,
  style,
  children,
}: {
  onPress?: () => void;
  label: string;
  style?: object;
  children: React.ReactNode;
}) {
  if (!onPress) {
    return <View style={style}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {children}
    </Pressable>
  );
}

export function PersonCard({name, streak, today, presence, avatarUri, onPress}: Props) {
  const {t} = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const chevronSpin = useRef(new Animated.Value(0)).current;
  const initials = initialsFor(name);
  const activeLabel = presence ? formatLastActive(presence, t) : null;

  function toggle() {
    const next = !expanded;
    // The body folds via LayoutAnimation; the chevron spins on its own native
    // driver so it turns in place instead of being dragged by the layout pass.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(chevronSpin, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(next);
  }

  return (
    <GlassCard style={styles.personCard}>
      {/* The row folds the daily games open; the avatar and name are their
          own tap targets that open the friend's profile. RN hands the touch to
          the innermost pressable, so tapping them navigates without toggling. */}
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={t('social.a11yToggleGames', {name})}
        accessibilityState={{expanded}}>
        <View style={styles.personRow}>
          <ProfileTarget onPress={onPress} label={name}>
            <View>
              <Avatar initials={initials} tone="soft" size={44} uri={avatarUri} />
              {presence?.online ? (
                <View
                  style={styles.onlineDot}
                  accessibilityLabel={t('social.a11yOnline')}
                />
              ) : null}
            </View>
          </ProfileTarget>
          <ProfileTarget onPress={onPress} label={name} style={styles.personName}>
            <Text variant="label" numberOfLines={1}>
              {name}
            </Text>
            {activeLabel ? (
              <Text variant="caption" color="tertiary" numberOfLines={1}>
                {activeLabel}
              </Text>
            ) : null}
          </ProfileTarget>
          {streak > 1 ? (
            <View
              style={styles.streak}
              accessibilityLabel={t('social.a11yStreak', {count: streak})}>
              <Flame size={14} color={colors.primary} strokeWidth={2.5} />
              <Text variant="caption" color="secondary">
                {streak}
              </Text>
            </View>
          ) : null}
          {/* Rotation lives on an Animated wrapper View, never the SVG's own
              style: under the New Architecture react-native-svg drops a
              `transform` set on the icon (it vanished instead of flipping). */}
          <Animated.View
            style={{
              transform: [
                {
                  rotate: chevronSpin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            }}>
            <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2} />
          </Animated.View>
        </View>
      </Pressable>
      {/* Full-width game rows — the same list the Log tab's day cards use,
          so a friend's card mirrors your own. Folded away until expanded. */}
      {expanded ? (
        <View>
          {DAILY_GAMES.map((game, i) => {
            const cell = today.get(game);
            return (
              <DailyRow
                key={game}
                game={game}
                status={cell?.status ?? 'notPlayed'}
                right={cell?.right ?? null}
                wrong={cell?.wrong ?? null}
                answer={cell?.answer ?? null}
                isLast={i === DAILY_GAMES.length - 1}
              />
            );
          })}
        </View>
      ) : null}
    </GlassCard>
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
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
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
