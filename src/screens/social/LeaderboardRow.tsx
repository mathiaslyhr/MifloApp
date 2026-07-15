/**
 * One ranked player on the worldwide board, as a full-width row inside the
 * board's Card (same divider recipe as DailyRow, so the board reads like
 * the rest of the daily language). Rank slot, avatar, name, and the one-line
 * result summary. The caller's own row is tinted with the brand accent — the
 * "you" idiom — resolved from the wire's is_me flag, never an id.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Avatar, Text, initialsFor} from '../../core/ui';
import {spacing, useThemedStyles, type Palette} from '../../theme';
import type {DailyGame} from '../../core/daily/dailyLog';
import {leaderboardSummary} from './leaderboardSummary';

type Props = {
  rank: number;
  game: DailyGame;
  name: string;
  avatarUri?: string | null;
  status: 'won' | 'revealed';
  score: number;
  total: number;
  /** Accent the row as the caller's own. */
  you?: boolean;
  /** Drop the hairline divider on the last row of a group. */
  isLast?: boolean;
};

export function LeaderboardRow({
  rank,
  game,
  name,
  avatarUri,
  status,
  score,
  total,
  you = false,
  isLast = false,
}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const summary = leaderboardSummary(game, status, score, total);
  const label = t(summary.key, summary.params);

  return (
    <View
      style={[styles.row, !isLast && styles.divider]}
      accessible
      accessibilityLabel={t('leaderboard.a11yRow', {rank, name, result: label})}>
      <Text
        variant="secondary"
        color={you ? 'primary' : 'tertiary'}
        style={[styles.rank, you && styles.rankYou]}>
        {rank}
      </Text>
      <Avatar initials={initialsFor(name)} tone="soft" size={36} uri={avatarUri} />
      <View style={styles.text}>
        <Text
          variant="label"
          numberOfLines={1}
          style={you ? styles.nameYou : undefined}>
          {you ? t('leaderboard.you') : name}
        </Text>
        <Text variant="caption" color="tertiary" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm + 2,
      minHeight: 48,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    // Fixed, right-aligned tabular figures so ranks line up in a column even at
    // three digits (the pinned "you" row can be well down the board).
    rank: {
      minWidth: 28,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    rankYou: {color: c.primaryInk},
    text: {flex: 1},
    nameYou: {color: c.primaryInk},
  });
