/**
 * One fan group on the Ball Knowledge board: rank, crest or flag, group name
 * with its counted-fans line, and the BK number. Same row recipe as
 * RankedBoardRow — fixed rank slot so every badge starts at the same x, tabular
 * digits so the number column stays a column, primaryInk accent on your own
 * group, and the same MedalCoin podium for places 1 to 3 (the user asked for
 * the boards to speak one language: a first place looks the same everywhere).
 *
 * Not pressable on purpose: a group row has nowhere to go in v1, and a
 * PressableScale that does nothing would be a lie.
 */
import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {radii, spacing, useThemedStyles, type Palette} from '../../theme';
import {formatBk} from '../../core/social/ballKnowledgeService';
import type {BkDimension, BkGroupRow as Row} from '../../core/social/ballKnowledgeService';
import {COIN_SIZE, MedalCoin, type Medal} from '../ranked/MedalCoin';
import {bkGroupImage, bkGroupName} from './bkDisplay';

type Props = {
  row: Row;
  dimension: BkDimension;
  /** Drop the hairline on the last row of the card. */
  isLast?: boolean;
};

export function BkGroupRow({row, dimension, isLast = false}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const name = bkGroupName(dimension, row.groupId);
  const image = bkGroupImage(dimension, row.groupId);

  return (
    <View
      style={!isLast && styles.divider}
      accessible
      accessibilityLabel={t('ballKnowledge.a11yRow', {
        rank: row.rank,
        group: t('ballKnowledge.groupFans', {name}),
        bk: formatBk(row.bk),
        count: row.members,
      })}>
      <View style={styles.row}>
        {row.rank <= 3 ? (
          <MedalCoin medal={row.rank as Medal} rank={row.rank} />
        ) : (
          <View style={styles.rankSlot}>
            <Text
              variant="secondary"
              color={row.isMine ? 'primary' : 'secondary'}
              style={[styles.rank, row.isMine && styles.mine]}>
              {row.rank}
            </Text>
          </View>
        )}
        <View style={styles.badge}>
          {image != null ? (
            <Image source={image} resizeMode="contain" style={styles.badgeImg} />
          ) : null}
        </View>
        <View style={styles.text}>
          {/* Two lines, never an ellipsis — same rule as the Home card: a cut
              club name reads as a bug (user report, 2026-07-28). */}
          <Text
            variant="label"
            numberOfLines={2}
            style={row.isMine ? styles.mine : undefined}>
            {t('ballKnowledge.groupFans', {name})}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {t('ballKnowledge.membersCounted', {count: row.members})}
          </Text>
        </View>
        <Text variant="label" style={[styles.bk, row.isMine && styles.mine]}>
          {formatBk(row.bk)}
        </Text>
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
    // Same footprint as the coin, so a medal row and a plain row hold one
    // column and every badge starts at the same x (RankedBoardRow's rule).
    rankSlot: {
      width: COIN_SIZE,
      alignItems: 'center',
    },
    rank: {fontVariant: ['tabular-nums']},
    badge: {
      width: 36,
      height: 36,
      borderRadius: radii.card,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    badgeImg: {width: 26, height: 26},
    text: {flex: 1},
    // Tabular so the BK column stays a column as the digits change.
    bk: {fontVariant: ['tabular-nums']},
    mine: {color: c.primaryInk},
  });
