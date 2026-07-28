/**
 * The Ball Knowledge duel: two fan groups side by side over one month. Each
 * column is a picker — tap it to swap that side for any club or country — so
 * the card is both the result and the controls, like the score bug of a match
 * you get to cast.
 *
 * The leading side's number wears primaryInk (identity accent, not a
 * right/wrong verdict — success/error stay reserved for answers). A side with
 * a chosen group but no counted fans this month keeps its column and says so;
 * pretending the group doesn't exist would read as a bug.
 */
import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Card, PressableScale, Text} from '../../core/ui';
import {radii, spacing, useThemedStyles, type Palette} from '../../theme';
import {formatBk} from '../../core/social/ballKnowledgeService';
import type {BkDimension, BkDuelSide} from '../../core/social/ballKnowledgeService';
import {bkGroupImage, bkGroupName} from './bkDisplay';

type SideProps = {
  dimension: BkDimension;
  /** The chosen group id; null when this side hasn't been picked yet. */
  groupId: string | null;
  /** The month's numbers; null while unpicked, loading, or with no counted fans. */
  side: BkDuelSide | null;
  /** Whether this side's BK beats the other's. */
  leading: boolean;
  onPress: () => void;
};

export function BkDuelCard({a, b}: {a: SideProps; b: SideProps}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.card}>
      <Side {...a} />
      <View style={styles.dividerCol}>
        <Text variant="caption" color="tertiary">
          {'vs'}
        </Text>
      </View>
      <Side {...b} />
    </Card>
  );
}

function Side({dimension, groupId, side, leading, onPress}: SideProps) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const name = groupId ? bkGroupName(dimension, groupId) : null;
  const image = groupId ? bkGroupImage(dimension, groupId) : null;

  const a11y = name
    ? side
      ? t('ballKnowledge.a11yDuelSide', {
          group: t('ballKnowledge.groupFans', {name}),
          bk: formatBk(side.bk),
          count: side.members,
        })
      : t('ballKnowledge.duelEmptySide', {group: t('ballKnowledge.groupFans', {name})})
    : t('ballKnowledge.duelPick');

  return (
    <PressableScale
      containerStyle={styles.sidePress}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}>
      <View style={styles.side}>
        <View style={styles.badge}>
          {image != null ? (
            <Image source={image} resizeMode="contain" style={styles.badgeImg} />
          ) : (
            <Text variant="caption" color="tertiary">
              {'?'}
            </Text>
          )}
        </View>
        <Text variant="secondary" numberOfLines={2} align="center" style={styles.name}>
          {name ? t('ballKnowledge.groupFans', {name}) : t('ballKnowledge.duelPick')}
        </Text>
        {side ? (
          <>
            <Text variant="stat" style={[styles.bk, leading && styles.leading]}>
              {formatBk(side.bk)}
            </Text>
            <Text variant="caption" color="secondary" align="center">
              {t('ballKnowledge.membersCounted', {count: side.members})}
            </Text>
          </>
        ) : name ? (
          <Text variant="caption" color="tertiary" align="center" style={styles.empty}>
            {t('ballKnowledge.duelNoFans')}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    sidePress: {flex: 1},
    side: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    dividerCol: {
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
    },
    badge: {
      width: 56,
      height: 56,
      borderRadius: radii.card,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    badgeImg: {width: 40, height: 40},
    name: {minHeight: 36},
    bk: {fontVariant: ['tabular-nums']},
    leading: {color: c.primaryInk},
    empty: {paddingTop: spacing.xs},
  });
