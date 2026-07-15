/**
 * Head to head — the record between you and one friend across the online party
 * games (Hattrick, Offside, Cult Hero, Red Card). Pushed from the friend's
 * profile. The tally is pairwise by score (higher score wins each shared game,
 * equal is a draw), read through the friends-only head_to_head RPC (0031), so it
 * only ever shows games you both played and never another player's result.
 *
 * The daily solo games are deliberately absent — head to head is for the games
 * you actually play against each other.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {Avatar, Card, initialsFor, Skeleton, Text, toast} from '../../core/ui';
import {
  fonts,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {isNetworkError} from '../../core/rooms/roomService';
import type {RootStackParamList} from '../../core/navigation';
import {dateKeyFor, previousDateKey} from '../../games/scout/dailySeed';
import {
  avatarUrlFor,
  fetchHeadToHead,
  getCachedProfile,
} from '../../core/social/socialService';
import {
  computeHeadToHead,
  outcomeOf,
  type HeadToHeadMatch,
  type MatchOutcome,
} from '../../core/social/headToHead';
import type {SocialProfile} from '../../core/social/types';
import {GAMES} from '../gamesCatalog';
import {MenuDetailScreen} from '../menu/MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'HeadToHead'>;

/** The online games head to head covers, in hub order, keyed by server type. */
const ONLINE_GAMES = GAMES.filter(
  g => g.available && !g.single && !g.daily,
);

/** Cap the recent list — enough to scroll a session, not the whole history. */
const RECENT_LIMIT = 20;

export function HeadToHeadScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const {profile} = route.params;

  const [matches, setMatches] = useState<HeadToHeadMatch[] | null>(null);
  const [me, setMe] = useState<SocialProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      getCachedProfile().then(cached => {
        if (live) {
          setMe(cached);
        }
      });
      fetchHeadToHead(profile.userId)
        .then(rows => {
          if (live) {
            setMatches(rows);
          }
        })
        .catch(err => {
          if (live) {
            toast.error(
              isNetworkError(err) ? t('common.errorNetwork') : t('social.loadError'),
            );
            setMatches(prev => prev ?? []);
          }
        });
      return () => {
        live = false;
      };
    }, [profile.userId, t]),
  );

  const summary = useMemo(
    () => (matches ? computeHeadToHead(matches) : null),
    [matches],
  );

  const myName = me?.displayName ?? t('headToHead.you');

  return (
    <MenuDetailScreen
      title={t('headToHead.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      {summary === null ? (
        <Skeleton height={140} />
      ) : summary.total === 0 ? (
        <>
          <Versus
            myName={myName}
            myAvatar={avatarUrlFor(me?.avatarPath)}
            theirName={profile.displayName}
            theirAvatar={avatarUrlFor(profile.avatarPath)}
            myWins={0}
            theirWins={0}
          />
          <Card style={styles.emptyCard}>
            <Text variant="secondary" color="secondary" align="center">
              {t('headToHead.empty', {name: profile.displayName})}
            </Text>
          </Card>
        </>
      ) : (
        <>
          <Versus
            myName={myName}
            myAvatar={avatarUrlFor(me?.avatarPath)}
            theirName={profile.displayName}
            theirAvatar={avatarUrlFor(profile.avatarPath)}
            myWins={summary.myWins}
            theirWins={summary.theirWins}
          />
          {summary.draws > 0 ? (
            <Text variant="caption" color="tertiary" align="center">
              {t('headToHead.draws', {count: summary.draws})}
            </Text>
          ) : null}

          <ByGameSection perGame={summary.perGame} />
          <RecentSection
            matches={matches!.slice(0, RECENT_LIMIT)}
            theirName={profile.displayName}
          />
        </>
      )}
    </MenuDetailScreen>
  );
}

/** Two faces with the score between them — the page's headline moment. */
function Versus({
  myName,
  myAvatar,
  theirName,
  theirAvatar,
  myWins,
  theirWins,
}: {
  myName: string;
  myAvatar: string | null;
  theirName: string;
  theirAvatar: string | null;
  myWins: number;
  theirWins: number;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.versus}>
      <View style={styles.versusSide}>
        <Avatar initials={initialsFor(myName)} tone="accent" size={64} uri={myAvatar} />
        <Text variant="caption" color="secondary" numberOfLines={1} style={styles.versusName}>
          {myName}
        </Text>
      </View>
      <View style={styles.scoreWrap}>
        <Text style={styles.score}>
          {myWins} – {theirWins}
        </Text>
      </View>
      <View style={styles.versusSide}>
        <Avatar
          initials={initialsFor(theirName)}
          tone="soft"
          size={64}
          uri={theirAvatar}
        />
        <Text variant="caption" color="secondary" numberOfLines={1} style={styles.versusName}>
          {theirName}
        </Text>
      </View>
    </View>
  );
}

/** Per-game breakdown: one row per online game you've played together. */
function ByGameSection({
  perGame,
}: {
  perGame: Record<string, {myWins: number; theirWins: number; draws: number}>;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const rows = ONLINE_GAMES.filter(g => perGame[g.gameType]);
  if (rows.length === 0) {
    return null;
  }
  return (
    <View style={styles.section}>
      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t('headToHead.byGame').toUpperCase()}
      </Text>
      <Card style={styles.card}>
        {rows.map((g, i) => {
          const rec = perGame[g.gameType];
          return (
            <View
              key={g.gameType}
              style={[styles.gameRow, i < rows.length - 1 && styles.rowDivider]}>
              <g.Icon size={18} color={colors.ink} strokeWidth={2} />
              <Text variant="body" style={styles.gameName} numberOfLines={1}>
                {t(`games.${g.i18nKey}.title`)}
              </Text>
              <Text variant="body" color="secondary">
                {rec.myWins} – {rec.theirWins}
              </Text>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

/** The recent matchups, newest first: game, date and who won. */
function RecentSection({
  matches,
  theirName,
}: {
  matches: HeadToHeadMatch[];
  theirName: string;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const todayKey = useMemo(() => dateKeyFor(new Date()), []);
  const months = t('dailyLog.months', {returnObjects: true}) as string[];
  const iconFor = useMemo(() => {
    const map = new Map<string, (typeof ONLINE_GAMES)[number]>(
      ONLINE_GAMES.map(g => [g.gameType, g]),
    );
    return (gameType: string) => map.get(gameType);
  }, []);

  function formatDate(playedAt: string): string {
    const key = dateKeyFor(new Date(playedAt));
    if (key === todayKey) {
      return t('dailyLog.today');
    }
    if (key === previousDateKey(todayKey)) {
      return t('dailyLog.yesterday');
    }
    const [, m, d] = key.split('-').map(Number);
    return `${d} ${months[m - 1] ?? m}`;
  }

  const outcomeColor: Record<MatchOutcome, string> = {
    win: colors.success,
    loss: colors.error,
    draw: colors.ink,
  };

  return (
    <View style={styles.section}>
      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t('headToHead.recent').toUpperCase()}
      </Text>
      <View style={styles.recentList}>
        {matches.map(match => {
          const entry = iconFor(match.gameType);
          const outcome = outcomeOf(match);
          const label =
            outcome === 'win'
              ? t('headToHead.youWon')
              : outcome === 'loss'
              ? t('headToHead.friendWon', {name: theirName})
              : t('headToHead.drawn');
          return (
            <Card key={match.matchId} style={styles.recentCard}>
              <View style={styles.recentTop}>
                {entry ? (
                  <entry.Icon size={16} color={colors.ink} strokeWidth={2} />
                ) : null}
                <Text variant="label" style={styles.recentGame} numberOfLines={1}>
                  {entry ? t(`games.${entry.i18nKey}.title`) : match.gameType}
                </Text>
                <Text variant="caption" color="tertiary">
                  {formatDate(match.playedAt)}
                </Text>
              </View>
              <View style={styles.recentBottom}>
                <Text
                  variant="secondary"
                  style={[styles.recentOutcome, {color: outcomeColor[outcome]}]}>
                  {label}
                </Text>
                <Text variant="secondary" color="secondary">
                  {match.mine.score} – {match.theirs.score}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.lg},
    versus: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: spacing.md,
    },
    versusSide: {alignItems: 'center', gap: spacing.xs, width: 96},
    versusName: {maxWidth: 96},
    scoreWrap: {height: 64, justifyContent: 'center'},
    // The scale's cap (20) — this score is the page's one deliberate moment.
    score: {
      fontFamily: fonts.medium,
      fontSize: 20,
      lineHeight: 24,
      color: c.ink,
    },
    section: {gap: spacing.sm},
    eyebrow: {letterSpacing: 1, marginLeft: spacing.md},
    card: {paddingHorizontal: spacing.lg, paddingVertical: spacing.xs},
    gameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    gameName: {flex: 1, color: c.ink},
    recentList: {gap: spacing.sm},
    recentCard: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    recentTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    recentGame: {flex: 1, color: c.ink},
    recentBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    recentOutcome: {flex: 1},
    emptyCard: {padding: spacing.xl},
  });
