/**
 * Red Card presentational atoms shared by the online screen and pass-and-play:
 * the vote grid, the one-by-one answer reveal, the reveal scoreboard, and the
 * votes list. Pure display over plain props — no room, no engine, no network.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Crown} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {Card, Tag, Text} from '../../core/ui';
import {
  fonts,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';

export type NamedPlayer = {userId: string; name: string};

/** Tappable roster of name tags; optionally hides one player (yourself). */
export function PlayerGrid({
  players,
  excludeId,
  onPick,
}: {
  players: NamedPlayer[];
  excludeId: string | null;
  onPick: (userId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pickGrid}>
      {players
        .filter(p => p.userId !== excludeId)
        .map(p => (
          <Tag
            key={p.userId}
            onPress={() => onPick(p.userId)}
            accessibilityRole="button"
            accessibilityLabel={p.name}>
            <Text variant="body" style={styles.pickName}>
              {p.name}
            </Text>
          </Tag>
        ))}
    </View>
  );
}

/**
 * One revealed answer with its author, plus progress dots for the round.
 * The advance button lives in the screens (host-gated online, open locally).
 */
export function AnswerRevealBlock({
  name,
  text,
  index,
  total,
}: {
  name: string;
  text: string;
  index: number;
  total: number;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const dots = [];
  for (let i = 0; i < total; i++) {
    dots.push(i);
  }
  return (
    <>
      <Card style={styles.answerCard}>
        <Text variant="caption" color="muted" align="center" style={styles.answerAuthor}>
          {name}
        </Text>
        <Text variant="section" align="center" style={styles.answerText}>
          {text}
        </Text>
      </Card>
      <View style={styles.answerProgress}>
        <View style={styles.answerDots}>
          {dots.map(i => (
            <View
              key={i}
              style={[styles.answerDot, i <= index && styles.answerDotDone]}
            />
          ))}
        </View>
        <Text variant="caption" color="muted">
          {t('redCard.answers.progress', {index: index + 1, total})}
        </Text>
      </View>
    </>
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.listCard}>
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
    </Card>
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
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pickName: {color: c.ink},
  answerCard: {gap: spacing.xs, padding: spacing.lg},
  answerAuthor: {letterSpacing: 1},
  answerText: {color: c.ink},
  answerProgress: {alignItems: 'center', gap: spacing.xs},
  answerDots: {flexDirection: 'row', gap: spacing.xs},
  answerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.ink,
    opacity: 0.2,
  },
  answerDotDone: {opacity: 1},
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
  points: {fontFamily: fonts.regular, color: c.ink},
  leaderName: {fontFamily: fonts.regular},
  leaderScore: {color: c.primary},
  scoreNameCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1},
  scoreValueCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  delta: {color: c.textTertiary},
  deltaUp: {color: c.success},
  votesBlock: {gap: 2, marginTop: spacing.xs, paddingHorizontal: spacing.sm},
  votesLabel: {letterSpacing: 1, marginBottom: spacing.xs},
  voteLine: {paddingVertical: 1},
  });
