/**
 * One friend's day, as a fixed-width card for the Home "Friends today"
 * carousel. Same content as the Friends tab's PersonCard when expanded (avatar +
 * name + streak, then the four DailyRows), but always unfolded and painted on
 * the sunken card recipe. It reuses the `friendCellsFor`/`friendStreak` helpers
 * and `DailyRow`.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Flame} from 'lucide-react-native';
import {Avatar, PressableScale, Text, initialsFor} from '../../core/ui';
import {DAILY_GAMES, type DailyGame} from '../../core/daily/dailyLog';
import {DailyRow} from '../../core/daily/DailyRow';
import type {ChipCell} from '../social/PersonCard';
import type {Presence} from '../../core/social/presence';
import {onRim, radii, spacing, useColors, useThemedStyles, type Palette} from '../../theme';

export function FriendTodayCard({
  name,
  avatarUri,
  presence,
  streak,
  today,
  width,
  onPress,
}: {
  name: string;
  avatarUri?: string | null;
  presence?: Presence;
  streak: number;
  today: Map<DailyGame, ChipCell>;
  /** Fixed card width so the next card peeks in the carousel. */
  width: number;
  onPress?: () => void;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const {t} = useTranslation();
  return (
    <PressableScale
      containerStyle={{width}}
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('home.friendCardA11y', {name})}>
      {/* Name row — avatar (+ online dot) + name + streak flame. */}
      <View style={styles.head}>
        <View>
          <Avatar initials={initialsFor(name)} tone="soft" size={40} uri={avatarUri} />
          {presence?.online ? <View style={styles.onlineDot} /> : null}
        </View>
        <Text variant="label" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {streak > 1 ? (
          <View style={styles.streak}>
            <Flame size={14} color={colors.primary} strokeWidth={2.5} />
            <Text variant="caption" color="secondary">
              {streak}
            </Text>
          </View>
        ) : null}
      </View>
      {/* The four daily rows — always shown (no fold in a carousel). */}
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
              isLast={i === DAILY_GAMES.length - 1}
            />
          );
        })}
      </View>
    </PressableScale>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: radii.card,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    head: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    name: {flex: 1},
    streak: {flexDirection: 'row', alignItems: 'center', gap: 2},
    // Green presence disc pinned to the avatar corner, rimmed in the card fill
    // so it reads on the card surface.
    onlineDot: {
      position: 'absolute',
      right: onRim(40, 12),
      bottom: onRim(40, 12),
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.success,
    },
  });
