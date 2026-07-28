/**
 * Home's way into Ball Knowledge: a card under the friends feed with one row
 * per fan group you belong to — club and country both, each with its crest or
 * flag, the group's BK number and its place this season. Rows paint straight
 * from the cached profile so the card never pops in late; the numbers arrive
 * from the board fetches and slot in beside them. On a fetch error the rows
 * stay (a broken number shouldn't cost the doorway), just without figures.
 *
 * Names get two lines, not an ellipsis — "Leicester C…" on the app's front
 * door reads as a bug (user report, 2026-07-28).
 *
 * A missing favorite becomes a quiet extra row inviting you to pick it; with
 * neither set the whole card is the invitation (useSetFavorite either way).
 * Owns its focus-effect fetch so HomeTab only mounts it.
 */
import React, {useCallback, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useFocusEffect} from '@react-navigation/native';
import {ChevronRight, Plus} from 'lucide-react-native';
import {PressableScale, Text} from '../../core/ui';
import {radii, spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {isBackendConfigured} from '../../core/config';
import {useAppNavigation} from '../../core/navigation';
import {getCachedProfile} from '../../core/social/socialService';
import {
  fetchBallKnowledgeBoard,
  formatBk,
  monthKeyFor,
} from '../../core/social/ballKnowledgeService';
import type {BkDimension, BkMe} from '../../core/social/ballKnowledgeService';
import {bkGroupImage, bkGroupName} from '../social/bkDisplay';
import {useSetFavorite} from '../social/useSetFavorite';

/** One fan group the user belongs to; club row first when both are set. */
type Anchor = {dimension: BkDimension; groupId: string};

export function BallKnowledgeCard(): React.JSX.Element | null {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const navigation = useAppNavigation();

  // null = still reading the cache; [] = no favorite set at all.
  const [anchors, setAnchors] = useState<Anchor[] | null>(null);
  const [me, setMe] = useState<Partial<Record<BkDimension, BkMe>>>({});

  // One loader for both triggers (focus, and a favorite just saved from a
  // CTA). Returns its own cancel so useFocusEffect can use it as the cleanup.
  const load = useCallback(() => {
    let alive = true;
    getCachedProfile()
      .then(p => {
        if (!alive) {
          return;
        }
        const next: Anchor[] = [];
        if (p?.favoriteClubId) {
          next.push({dimension: 'club', groupId: p.favoriteClubId});
        }
        if (p?.favoriteNation) {
          next.push({dimension: 'nation', groupId: p.favoriteNation});
        }
        setAnchors(next);
        if (!isBackendConfigured) {
          return;
        }
        for (const anchor of next) {
          fetchBallKnowledgeBoard(anchor.dimension, monthKeyFor(new Date()))
            .then(board => {
              if (alive && board.me) {
                setMe(prev => ({...prev, [anchor.dimension]: board.me}));
              }
            })
            // Silent: the row still opens the board, which explains itself.
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  const pickFavorite = useSetFavorite(() => {
    setMe({});
    load();
  });

  const months = t('ballKnowledge.months', {returnObjects: true}) as string[];
  const monthName = months[new Date().getMonth()] ?? '';

  if (anchors === null) {
    // Cache still loading — hold the card's spot so the page doesn't jump.
    return <View style={styles.placeholder} />;
  }

  if (anchors.length === 0) {
    return (
      <PressableScale
        onPress={() => pickFavorite('club')}
        accessibilityRole="button"
        accessibilityLabel={t('ballKnowledge.noFavorite')}
        style={styles.card}>
        <View style={styles.row}>
          <Text variant="secondary" color="secondary" style={styles.ctaText}>
            {t('ballKnowledge.noFavorite')}
          </Text>
          <ChevronRight size={15} color={colors.textSecondary} />
        </View>
      </PressableScale>
    );
  }

  const missing: BkDimension | null = !anchors.some(a => a.dimension === 'club')
    ? 'club'
    : !anchors.some(a => a.dimension === 'nation')
      ? 'nation'
      : null;

  return (
    <View style={styles.card}>
      {anchors.map((anchor, i) => {
        const name = bkGroupName(anchor.dimension, anchor.groupId);
        const image = bkGroupImage(anchor.dimension, anchor.groupId);
        const mine = me[anchor.dimension] ?? null;
        const bk = mine?.groupBk ?? null;
        const subline =
          mine == null
            ? monthName
            : mine.rank != null
              ? t('ballKnowledge.homeRank', {rank: mine.rank, month: monthName})
              : t('ballKnowledge.homeNoRank');
        return (
          <PressableScale
            key={anchor.dimension}
            onPress={() =>
              navigation.navigate('BallKnowledge', {dimension: anchor.dimension})
            }
            accessibilityRole="button"
            accessibilityLabel={t('ballKnowledge.a11yHomeCard', {
              group: t('ballKnowledge.groupFans', {name}),
            })}
            style={[styles.row, i > 0 && styles.divider]}>
            <View style={styles.badge}>
              {image != null ? (
                <Image source={image} resizeMode="contain" style={styles.badgeImg} />
              ) : null}
            </View>
            <View style={styles.text}>
              <Text variant="label" numberOfLines={2}>
                {t('ballKnowledge.groupFans', {name})}
              </Text>
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {subline}
              </Text>
            </View>
            {bk != null ? (
              <Text variant="stat" style={styles.bk}>
                {formatBk(bk)}
              </Text>
            ) : null}
            <ChevronRight size={15} color={colors.textTertiary} strokeWidth={2} />
          </PressableScale>
        );
      })}

      {missing ? (
        <PressableScale
          onPress={() => pickFavorite(missing)}
          accessibilityRole="button"
          accessibilityLabel={t(
            missing === 'club' ? 'ballKnowledge.homeAddClub' : 'ballKnowledge.homeAddNation',
          )}
          style={[styles.row, styles.divider]}>
          <View style={[styles.badge, styles.badgeGhost]}>
            <Plus size={16} color={colors.textTertiary} strokeWidth={2} />
          </View>
          <Text variant="secondary" color="secondary" style={styles.ctaText}>
            {t(
              missing === 'club'
                ? 'ballKnowledge.homeAddClub'
                : 'ballKnowledge.homeAddNation',
            )}
          </Text>
          <ChevronRight size={15} color={colors.textTertiary} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    placeholder: {height: 128},
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: radii.card,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    ctaText: {flex: 1},
    badge: {
      width: 40,
      height: 40,
      borderRadius: radii.card,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    badgeGhost: {backgroundColor: 'transparent'},
    badgeImg: {width: 28, height: 28},
    text: {flex: 1},
    bk: {fontVariant: ['tabular-nums'], color: c.primaryInk},
  });
