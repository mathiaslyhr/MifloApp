/**
 * Red Card presentational atoms shared by the online screen and pass-and-play:
 * the vote grid, the reveal scoreboard, and the votes list. Pure display over
 * plain props — no room, no engine, no network.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Crown} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {GlassCard, GlassTag, Text} from '../../core/ui';
import {colors, fonts, spacing} from '../../theme';

export type NamedPlayer = {userId: string; name: string};

/** Tappable roster of glass name tags; optionally hides one player (yourself). */
export function PlayerGrid({
  players,
  excludeId,
  onPick,
}: {
  players: NamedPlayer[];
  excludeId: string | null;
  onPick: (userId: string) => void;
}) {
  return (
    <View style={styles.pickGrid}>
      {players
        .filter(p => p.userId !== excludeId)
        .map(p => (
          <GlassTag
            key={p.userId}
            onPress={() => onPick(p.userId)}
            accessibilityRole="button"
            accessibilityLabel={p.name}>
            <Text variant="body" style={styles.pickName}>
              {p.name}
            </Text>
          </GlassTag>
        ))}
    </View>
  );
}

/** Reveal scoreboard — this hand's delta + running total, leader crowned. */
export function Scoreboard({
  rows,
  deltas,
}: {
  /** Players sorted by running score (desc). */
  rows: {userId: string; name: string; score: number}[];
  deltas: Record<string, number>;
}) {
  const {t} = useTranslation();
  return (
    <GlassCard style={styles.listCard}>
      <Text variant="label" style={styles.listTitle}>
        {t('redCard.reveal.scoreboard')}
      </Text>
      {rows.map((row, i) => {
        const d = deltas[row.userId] ?? 0;
        return (
          <View key={row.userId} style={styles.listRow}>
            <View style={styles.scoreNameCol}>
              {i === 0 ? (
                <Crown size={14} color={colors.primary} strokeWidth={2} />
              ) : null}
              <Text
                variant="body"
                numberOfLines={1}
                style={i === 0 ? styles.leaderName : undefined}>
                {row.name}
              </Text>
            </View>
            <View style={styles.scoreValueCol}>
              {d !== 0 ? (
                <Text
                  variant="secondary"
                  style={d > 0 ? styles.deltaUp : styles.delta}>
                  {d > 0 ? `+${d}` : d}
                </Text>
              ) : null}
              <Text
                variant="body"
                style={[styles.points, i === 0 && styles.leaderScore]}>
                {row.score}
              </Text>
            </View>
          </View>
        );
      })}
    </GlassCard>
  );
}

/** Who voted for whom — de-emphasised, no card chrome. */
export function VotesBlock({
  votes,
  nameOf,
}: {
  /** voterId -> the id they voted for. */
  votes: Record<string, string>;
  nameOf: (id: string) => string;
}) {
  const {t} = useTranslation();
  return (
    <View style={styles.votesBlock}>
      <Text variant="caption" color="muted" style={styles.votesLabel}>
        {t('redCard.reveal.votesTitle')}
      </Text>
      {Object.entries(votes).map(([voter, targetId]) => (
        <Text key={voter} variant="secondary" color="muted" style={styles.voteLine}>
          {t('redCard.reveal.votedFor', {
            voter: nameOf(voter),
            target: nameOf(targetId),
          })}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pickName: {color: colors.ink},
  listCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  listTitle: {fontFamily: fonts.regular, marginBottom: spacing.xs},
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  points: {fontFamily: fonts.regular, color: colors.ink},
  leaderName: {fontFamily: fonts.regular},
  leaderScore: {color: colors.primary},
  scoreNameCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1},
  scoreValueCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  delta: {color: colors.textTertiary},
  deltaUp: {color: colors.success},
  votesBlock: {gap: 2, marginTop: spacing.xs, paddingHorizontal: spacing.sm},
  votesLabel: {letterSpacing: 1, marginBottom: spacing.xs},
  voteLine: {paddingVertical: 1},
});
