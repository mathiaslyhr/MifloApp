/**
 * One player on the ranked board: rank, face, name, € standing, and the
 * played/W-D-L line. Same recipe as the daily board's LeaderboardRow (36pt soft
 * Avatar, primaryInk on your own row), copied rather than imported: that
 * component is coupled to the dailies through its `game` prop.
 *
 * Ranks 1-3 carry a metal coin instead of a bare digit (see MedalCoin). NOTHING
 * paints behind the row itself, and that's load-bearing: two earlier designs put
 * a fill back there and both failed. A partial-width € bar read as a rendering
 * glitch, and a full-row gold wash had to stay so dim (near-white text sits on
 * it) that it turned olive. The coin owns its own pixels, so it can be real
 * metal without touching the row's legibility.
 *
 * The rank slot is a fixed square, so ranks 1-3 (coin) and 4+ (plain digit) hold
 * the same column and every avatar starts at the same x. It is not right-aligned:
 * right-aligning looks tidier in a deep table of many digits, but with one-digit
 * ranks it shoved the "1" ~21pt inward while the € stayed 16pt off the other
 * edge, and the row read as lopsided. Now both margins are just the row's padding.
 *
 * The € sits inside the text column, not beside it, so the stats line below runs
 * the column's full width instead of being squeezed to an ellipsis by it.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Avatar, Text, initialsFor} from '../../core/ui';
import {spacing, useThemedStyles, type Palette} from '../../theme';
import {formatValue} from '../../games/ranked-hattrick/value';
import {COIN_SIZE, MedalCoin, type Medal} from './MedalCoin';

type Props = {
  rank: number;
  /** Null only on the caller's own pinned row, which reads "You" instead. */
  name: string | null;
  avatarUri?: string | null;
  value: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** Accent the row as the caller's own. */
  you?: boolean;
  /** The € still needed to reach the last visible place. Pinned row only; null
   * whenever there's no gap worth naming. */
  gap?: number | null;
  /** Drop the hairline on the last row of a group. */
  isLast?: boolean;
};

export function RankedBoardRow({
  rank,
  name,
  avatarUri,
  value,
  played,
  wins,
  draws,
  losses,
  you = false,
  gap = null,
  isLast = false,
}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const shown = formatValue(value);
  const label = you ? t('leaderboard.you') : name ?? '';
  // A pinned row is out of the slice by definition, so it can never be a medal
  // place; guarding on `gap` keeps a rank-3 pin from wearing bronze.
  const medal: Medal | null = rank <= 3 && gap == null ? (rank as Medal) : null;

  return (
    <View
      style={!isLast && styles.divider}
      accessible
      accessibilityLabel={t('rankedBoard.a11yRow', {
        rank,
        name: label,
        value: shown,
        w: wins,
        d: draws,
        l: losses,
      })}>
      <View style={styles.row}>
        {medal ? (
          <MedalCoin medal={medal} rank={rank} />
        ) : (
          <View style={styles.rankSlot}>
            <Text
              variant="secondary"
              color={you ? 'primary' : 'secondary'}
              style={[styles.rank, you && styles.rankYou]}>
              {rank}
            </Text>
          </View>
        )}
        <Avatar initials={initialsFor(label)} tone="soft" size={36} uri={avatarUri} />
        <View style={styles.text}>
          <View style={styles.topLine}>
            <Text
              variant="label"
              numberOfLines={1}
              style={[styles.name, you && styles.nameYou]}>
              {label}
            </Text>
            <Text variant="label" style={[styles.value, you && styles.valueYou]}>
              {shown}
            </Text>
          </View>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {t('rankedBoard.rowStats', {played, w: wins, d: draws, l: losses})}
          </Text>
          {gap != null ? (
            <Text variant="caption" numberOfLines={1} style={styles.gap}>
              {t('rankedBoard.gapToTop', {value: formatValue(gap)})}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    // Same footprint as the coin, so a medal row and a plain row hold one column
    // and every avatar starts at the same x.
    rankSlot: {
      width: COIN_SIZE,
      alignItems: 'center',
    },
    rank: {fontVariant: ['tabular-nums']},
    rankYou: {color: c.primaryInk},
    text: {flex: 1},
    topLine: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    name: {flex: 1},
    nameYou: {color: c.primaryInk},
    // Tabular so the € column stays a column as the digits change.
    value: {fontVariant: ['tabular-nums']},
    valueYou: {color: c.primaryInk},
    gap: {color: c.primaryInk},
  });
