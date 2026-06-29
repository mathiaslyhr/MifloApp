import React, {useCallback, useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Icon, Screen, ScreenHeader, Text} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation/types';
import {
  computeCareerStats,
  fetchMyResults,
} from '../core/stats/statsService';
import type {CareerStats, GameResult} from '../core/stats/types';
import {formatPoints, TOPICS} from '../games/quiz/mockData';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  TOPICS.map(t => [t.id, t.label]),
);

function topicSummary(topicIds: string[]): string {
  if (topicIds.length === 0) {
    return 'Quiz';
  }
  return topicIds.map(id => TOPIC_LABELS[id] ?? id).join(' · ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Your personal scoreboard (M5): career totals across every finished game on
 * this device, plus a history of recent games. Reads only this device's own
 * results (RLS scopes rows to the anonymous user).
 */
export function StatsScreen({navigation}: Props) {
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [error, setError] = useState(false);

  // Refetch every time the screen is focused so a just-finished game shows up.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(false);
      fetchMyResults()
        .then(r => active && setResults(r))
        .catch(() => active && setError(true));
      return () => {
        active = false;
      };
    }, []),
  );

  const stats: CareerStats | null = results ? computeCareerStats(results) : null;

  return (
    <Screen>
      <ScreenHeader title="Your stats" onBack={() => navigation.goBack()} />

      {results === null && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text variant="body" color="textSecondary" center>
            Couldn't load your stats. Check your connection and try again.
          </Text>
        </View>
      ) : stats && stats.gamesPlayed === 0 ? (
        <View style={styles.center}>
          <Icon name="trophy" size={32} color="textSecondary" />
          <Text variant="body" color="textSecondary" center style={styles.emptyText}>
            No games yet. Play a game and your results will show up here.
          </Text>
        </View>
      ) : (
        stats && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.summary}>
              <StatCell label="Games" value={`${stats.gamesPlayed}`} />
              <StatCell label="Wins" value={`${stats.wins}`} />
              <StatCell
                label="Win rate"
                value={`${Math.round(stats.winRate * 100)}%`}
              />
              <StatCell label="Best" value={formatPoints(stats.bestScore)} />
              <StatCell
                label="Total points"
                value={formatPoints(stats.totalPoints)}
              />
            </View>

            <Text variant="secondary" color="textSecondary" style={styles.sectionLabel}>
              Recent games
            </Text>
            <View style={styles.history}>
              {results!.map((r, i) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  divider={i < results!.length - 1}
                />
              ))}
            </View>
          </ScrollView>
        )
      )}
    </Screen>
  );
}

function StatCell({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.cell}>
      <Text variant="title">{value}</Text>
      <Text variant="secondary" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

function ResultRow({result, divider}: {result: GameResult; divider: boolean}) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={styles.rowLeft}>
        <Text variant="body" numberOfLines={1}>
          {topicSummary(result.topicIds)}
        </Text>
        <Text variant="secondary" color="textSecondary">
          {formatDate(result.playedAt)} · {result.totalPlayers} players
        </Text>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.rank}>
          {result.isWinner && <Icon name="trophy" size={16} color="primary" />}
          <Text
            variant="body"
            color={result.isWinner ? 'textPrimary' : 'textSecondary'}>
            #{result.rank}
          </Text>
        </View>
        <Text variant="secondary" color="textSecondary">
          {formatPoints(result.score)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {maxWidth: 260},
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    rowGap: spacing.lg,
  },
  cell: {
    width: '33%',
    gap: spacing.xs / 2,
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  history: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowLeft: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs / 2,
  },
  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
