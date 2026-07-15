/**
 * The worldwide board: for one daily game, today's best players across the
 * whole app (public by design), ranked most-right then fewest-tries. A row of
 * icon pills switches games; the list is one Card of LeaderboardRows, with
 * the caller's own row pinned at the bottom when it falls outside the top slice.
 *
 * Lives inside the Friends tab's ScrollView (no scroll of its own). Fetches on
 * activation and whenever the game switches; no realtime — a board only moves
 * as people finish, and a tab revisit re-fetches.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Card, Tag, Skeleton, Text} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {isBackendConfigured} from '../../core/config';
import {DAILY_GAMES, type DailyGame} from '../../core/daily/dailyLog';
import {GAME_META} from '../../core/daily/DailyRow';
import {avatarUrlFor, fetchWorldwideLeaderboard} from '../../core/social/socialService';
import type {LeaderboardView} from '../../core/social/types';
import {LeaderboardRow} from './LeaderboardRow';

type Props = {
  todayKey: string;
  /** The tab shell's focus signal — refetch when the tab is looked at. */
  active: boolean;
  /** The caller's own name/avatar, for the pinned "you" row when out of slice. */
  myName?: string;
  myAvatarUri?: string | null;
};

type State = 'loading' | 'error' | LeaderboardView;

export function WorldwideBoard({todayKey, active, myName, myAvatarUri}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [game, setGame] = useState<DailyGame>('scout');
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!active || !isBackendConfigured) {
      return;
    }
    let live = true;
    setState('loading');
    fetchWorldwideLeaderboard(todayKey, game)
      .then(view => {
        if (live) {
          setState(view);
        }
      })
      .catch(() => {
        // Surface nothing noisy here: the inline error row explains it; a
        // network blip on a passive board doesn't warrant a toast.
        if (live) {
          setState('error');
        }
      });
    return () => {
      live = false;
    };
  }, [game, todayKey, active]);

  const meInList =
    state !== 'loading' && state !== 'error' && state.rows.some(r => r.isMe);

  return (
    <View style={styles.container}>
      {/* Game switcher — icon-only pills, accent on the active game. */}
      <View style={styles.switcher}>
        {DAILY_GAMES.map(g => {
          const {Icon, titleKey} = GAME_META[g];
          const selected = g === game;
          return (
            <Tag
              key={g}
              onPress={() => setGame(g)}
              accent={selected}
              accessibilityRole="button"
              accessibilityLabel={t(titleKey)}
              style={styles.switchTag}>
              <Icon
                size={18}
                color={selected ? colors.primaryInk : colors.textSecondary}
                strokeWidth={2}
              />
            </Tag>
          );
        })}
      </View>

      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t('leaderboard.todayEyebrow', {game: t(GAME_META[game].titleKey)}).toUpperCase()}
      </Text>

      {!isBackendConfigured ? (
        <Card style={styles.messageCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('leaderboard.unavailable')}
          </Text>
        </Card>
      ) : state === 'loading' ? (
        <Skeleton height={220} />
      ) : state === 'error' ? (
        <Card style={styles.messageCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('leaderboard.loadError')}
          </Text>
        </Card>
      ) : state.rows.length === 0 ? (
        <Card style={styles.messageCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('leaderboard.empty', {game: t(GAME_META[game].titleKey)})}
          </Text>
        </Card>
      ) : (
        <Card style={styles.board}>
          {state.rows.map((row, i) => (
            <LeaderboardRow
              key={`${row.rank}-${i}`}
              rank={row.rank}
              game={game}
              name={row.displayName}
              avatarUri={avatarUrlFor(row.avatarPath)}
              status={row.status}
              score={row.score}
              total={row.total}
              you={row.isMe}
              isLast={i === state.rows.length - 1}
            />
          ))}
          {/* Pin the caller's own rank when it sits below the visible slice. */}
          {state.me && !meInList ? (
            <View style={styles.pinned}>
              <LeaderboardRow
                rank={state.me.rank}
                game={game}
                name={myName ?? ''}
                avatarUri={myAvatarUri}
                status={state.me.status}
                score={state.me.score}
                total={state.me.total}
                you
                isLast
              />
            </View>
          ) : null}
        </Card>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: {gap: spacing.md},
    switcher: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    switchTag: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    eyebrow: {
      letterSpacing: 1,
      paddingHorizontal: spacing.sm,
    },
    messageCard: {padding: spacing.xl},
    board: {paddingHorizontal: spacing.lg, paddingVertical: spacing.xs},
    // A stronger top rule sets the pinned "you" row apart from the top slice.
    pinned: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
  });
