/**
 * The career page: what your € is, where it has been, and who moved it.
 *
 * One RPC (rh_match_history, 0041) feeds all three — the hero's tier and
 * standing, the curve, and the recent-matches list — so the whole segment costs
 * a single round trip and paints from the disk cache on frame one.
 *
 * The hero deliberately reads its progress against the current TIER, not the
 * €250M cap: "62% of the way to First Team" is a goal you can act on this
 * evening, where "4% of the way to €250M" is noise.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {ArrowDownRight, ArrowUpRight} from 'lucide-react-native';
import {Button, Card, Skeleton, Text} from '../../core/ui';
import {fonts, spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {formatDelta, formatValue} from '../../games/ranked-hattrick/value';
import {tierFor} from '../../games/ranked-hattrick/tiers';
import {seriesFrom} from '../../games/ranked-hattrick/history';
import {ValueChart} from './ValueChart';
import {MatchHistory} from './MatchHistory';
import type {MyHistory} from '../../games/ranked-hattrick/history';

/** How many matches the list shows. The chart still reads the whole window. */
const RECENT = 8;

type Props = {
  history: MyHistory | null;
  /** The € standing right now, from player_ratings — the authority. */
  value: number | null;
  todayKey: string;
  onFindMatch: () => void;
};

export function CareerSection({history, value, todayKey, onFindMatch}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  if (history === null || value === null) {
    return (
      <View style={styles.section}>
        <Skeleton height={232} />
        <Skeleton height={96} />
      </View>
    );
  }

  const {matches, record} = history;
  const played = record.wins + record.losses + record.draws;

  // Nothing played: no curve to draw, so say what would draw one.
  if (played === 0 || matches.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text variant="section">{t('profile.careerEmptyTitle')}</Text>
        <Text variant="secondary" color="secondary">
          {t('profile.careerEmptyBody')}
        </Text>
        <Button label={t('profile.findMatch')} onPress={onFindMatch} />
      </Card>
    );
  }

  const {tier, next, progress} = tierFor(value);
  const series = seriesFrom(matches);
  // The window's swing, not the last match's: the chart shows this whole span,
  // so the chip has to describe the same thing the eye is following.
  const since = series.length > 0 ? value - series[0] : 0;
  const up = since >= 0;
  const DeltaIcon = up ? ArrowUpRight : ArrowDownRight;
  const deltaColor = up ? colors.success : colors.error;
  const pct = Math.round(progress * 100);

  return (
    <View style={styles.section}>
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroLead}>
            <Text variant="caption" color="muted">
              {t(`play.tiers.${tier.key}`).toUpperCase()}
            </Text>
            <Text style={[styles.value, {color: colors.primary}]}>
              {formatValue(value)}
            </Text>
          </View>
          {since !== 0 ? (
            <View style={styles.deltaChip}>
              <DeltaIcon size={15} color={deltaColor} strokeWidth={2.25} />
              <Text variant="secondary" style={{color: deltaColor}}>
                {formatDelta(since)}
              </Text>
            </View>
          ) : null}
        </View>

        <ValueChart series={series} tierLabel={key => t(`play.tiers.${key}`)} />

        <View style={styles.heroFoot}>
          <Text variant="caption" color="tertiary">
            {next
              ? t('profile.towardTier', {tier: t(`play.tiers.${next.key}`), pct})
              : t('profile.topTier')}
          </Text>
        </View>
      </Card>

      {/* Played / record / win rate — the three numbers a ladder is judged on. */}
      <Card style={styles.recordCard}>
        <Stat label={t('profile.played')} value={String(played)} />
        <View style={styles.recordDivider} />
        <Stat
          label={t('profile.record')}
          value={t('profile.recordValue', {
            w: record.wins,
            l: record.losses,
            d: record.draws,
          })}
        />
        <View style={styles.recordDivider} />
        <Stat
          label={t('profile.winRate')}
          value={`${Math.round((record.wins / played) * 100)}%`}
        />
      </Card>

      <MatchHistory matches={matches.slice(0, RECENT)} todayKey={todayKey} />
    </View>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text variant="label" style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" color="tertiary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    section: {gap: spacing.lg},
    emptyCard: {padding: spacing.xl, gap: spacing.md},
    heroCard: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
    },
    heroTop: {flexDirection: 'row', alignItems: 'flex-start'},
    heroLead: {flex: 1, gap: spacing.xs},
    // The page's one deliberate "moment" above the section scale — the € is
    // what this whole segment is about.
    value: {
      fontFamily: fonts.regular,
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    deltaChip: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
    heroFoot: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      paddingTop: spacing.md,
    },
    recordCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    recordDivider: {width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: c.divider},
    stat: {flex: 1, alignItems: 'center', gap: 2},
    statValue: {fontVariant: ['tabular-nums']},
  });
