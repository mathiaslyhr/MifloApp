/**
 * Recent ranked matches — who you played, how it went, what it cost or paid.
 *
 * The € chart above this says the same thing as a shape; this says it with
 * names, which is the part people actually talk about. One card, a row per
 * match, hairline-separated (a divider inside a card uses the card's own border
 * colour, never darker — design.md §2).
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Avatar, Card, Text, initialsFor} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {avatarUrlFor} from '../../core/social/socialService';
import {formatDelta} from '../../games/ranked-hattrick/value';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {useDayLabel} from './dayLabel';
import type {MatchOutcome, RankedMatch} from '../../games/ranked-hattrick/history';

type Props = {
  matches: RankedMatch[];
  todayKey: string;
};

export function MatchHistory({matches, todayKey}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dayLabel = useDayLabel(todayKey);

  if (matches.length === 0) {
    return null;
  }

  const outcomeColor: Record<MatchOutcome, string> = {
    win: colors.success,
    loss: colors.error,
    draw: colors.textSecondary,
  };

  return (
    <View style={styles.section}>
      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t('profile.recentMatches').toUpperCase()}
      </Text>
      <Card style={styles.card}>
        {matches.map((m, i) => {
          // A null opponent means they've deleted their profile; the match still
          // happened, so it keeps its row and loses only its face.
          const name = m.opponent?.name ?? t('profile.unknownOpponent');
          const last = i === matches.length - 1;
          return (
            <View key={m.matchId} style={[styles.row, !last && styles.rowDivider]}>
              <Avatar
                initials={m.opponent ? initialsFor(name) : '?'}
                tone="soft"
                size={36}
                uri={m.opponent ? avatarUrlFor(m.opponent.avatarPath) : null}
              />
              <View style={styles.info}>
                <Text variant="label" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="caption" color="tertiary">
                  {`${t(`profile.outcome.${m.result}`)} · ${dayLabel(
                    dateKeyFor(new Date(m.at)),
                  )}`}
                </Text>
              </View>
              <Text variant="secondary" style={[styles.delta, {color: outcomeColor[m.result]}]}>
                {formatDelta(m.delta)}
              </Text>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    section: {gap: spacing.sm},
    eyebrow: {letterSpacing: 1, marginLeft: spacing.md},
    card: {paddingHorizontal: spacing.lg},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    info: {flex: 1, gap: 2},
    // The € is the row's number: tabular digits keep the column from dancing
    // as the list scrolls.
    delta: {fontVariant: ['tabular-nums']},
  });
