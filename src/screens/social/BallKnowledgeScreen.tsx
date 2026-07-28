/**
 * Ball Knowledge — the fan-group competition. Favorites say who you support,
 * the four dailies say how you play; the server (0049) joins them into one
 * 0..100 number per fan base: the share of answers that were right, averaged
 * per member, over one calendar month.
 *
 * Two views off one Segmented, like Play's Friendlies|Competitive: Standings
 * (every club's or country's fan base ranked, last month's champion crowned on
 * top) and Duel (any two fan bases head to head — Barca vs Real, Denmark vs
 * Sweden — with your own group pre-loaded on the left). A second Segmented
 * flips the dimension between clubs and countries.
 *
 * Fetches per dimension on mount and on switch, RankedLeaderboardScreen's
 * recipe exactly: no cache, no realtime, inline Message on error, no toast on
 * a passive board.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Trophy} from 'lucide-react-native';
import {Button, Card, Segmented, Skeleton, Text, type SegmentedOption} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {isBackendConfigured} from '../../core/config';
import type {RootStackParamList} from '../../core/navigation';
import {
  BK_MIN_MEMBERS,
  BK_MIN_PLAYED,
  fetchBallKnowledgeBoard,
  fetchBallKnowledgeDuel,
  monthKeyFor,
} from '../../core/social/ballKnowledgeService';
import type {
  BkBoard,
  BkDimension,
  BkDuel,
} from '../../core/social/ballKnowledgeService';
import {useSearch} from '../../games/shared/SearchScreen';
import {clubSource, nationSource} from '../../games/shared/searchSources';
import {MenuDetailScreen} from '../menu/MenuDetailScreen';
import {BkDuelCard} from './BkDuelCard';
import {BkGroupRow} from './BkGroupRow';
import {bkGroupName} from './bkDisplay';
import {useSetFavorite} from './useSetFavorite';

type Props = NativeStackScreenProps<RootStackParamList, 'BallKnowledge'>;

type View_ = 'standings' | 'duel';
type BoardState = 'loading' | 'error' | BkBoard;
type DuelState = 'idle' | 'loading' | 'error' | BkDuel;

export function BallKnowledgeScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const openSearch = useSearch();

  const [view, setView] = useState<View_>('standings');
  const [dimension, setDimension] = useState<BkDimension>(
    route.params?.dimension ?? 'club',
  );
  const [board, setBoard] = useState<BoardState>('loading');
  // Duel sides are per-visit choices, not persisted anywhere: a duel is a
  // question you ask, not a setting.
  const [sideA, setSideA] = useState<string | null>(null);
  const [sideB, setSideB] = useState<string | null>(null);
  const [duel, setDuel] = useState<DuelState>('idle');
  const [boardBust, setBoardBust] = useState(0);

  const monthKey = useMemo(() => monthKeyFor(new Date()), []);
  // Full month names ("July"), not dailyLog's short ones: the season copy is a
  // sentence, and "The Jul season" reads like a glitch.
  const months = t('ballKnowledge.months', {returnObjects: true}) as string[];
  const monthLabel = useCallback(
    (key: string) => {
      const [y, m] = key.split('-').map(Number);
      return `${months[m - 1] ?? m} ${y}`;
    },
    [months],
  );
  const seasonMonth = months[Number(monthKey.split('-')[1]) - 1] ?? '';

  useEffect(() => {
    if (!isBackendConfigured) {
      return;
    }
    let live = true;
    setBoard('loading');
    fetchBallKnowledgeBoard(dimension, monthKey)
      .then(next => {
        if (live) {
          setBoard(next);
          // Your own fan base opens the duel — but never clobber a side the
          // user already picked by hand.
          setSideA(prev => prev ?? next.me?.groupId ?? null);
        }
      })
      .catch(() => {
        if (live) {
          setBoard('error');
        }
      });
    return () => {
      live = false;
    };
  }, [dimension, monthKey, boardBust]);

  useEffect(() => {
    if (!isBackendConfigured || !sideA || !sideB) {
      setDuel('idle');
      return;
    }
    let live = true;
    setDuel('loading');
    fetchBallKnowledgeDuel(dimension, sideA, sideB, monthKey)
      .then(next => {
        if (live) {
          setDuel(next);
        }
      })
      .catch(() => {
        if (live) {
          setDuel('error');
        }
      });
    return () => {
      live = false;
    };
  }, [dimension, sideA, sideB, monthKey]);

  const pickFavorite = useSetFavorite(() => setBoardBust(b => b + 1));

  function switchDimension(next: BkDimension) {
    if (next === dimension) {
      return;
    }
    setDimension(next);
    // A club and a country are different populations; carrying picked sides
    // across would duel "barcelona" against nothing it can match.
    setSideA(null);
    setSideB(null);
    setDuel('idle');
  }

  function pickSide(assign: (id: string) => void) {
    const source = dimension === 'club' ? clubSource() : nationSource();
    openSearch(source, {
      title: t('ballKnowledge.duelPick'),
      placeholder: t('profile.favoriteSearchPlaceholder'),
    }).then(item => {
      if (item) {
        assign(item.id);
      }
    });
  }

  const viewOptions: SegmentedOption<View_>[] = [
    {key: 'standings', label: t('ballKnowledge.leaderboard')},
    {key: 'duel', label: t('ballKnowledge.compare')},
  ];
  const dimensionOptions: SegmentedOption<BkDimension>[] = [
    {key: 'club', label: t('ballKnowledge.club')},
    {key: 'nation', label: t('ballKnowledge.nation')},
  ];

  return (
    <MenuDetailScreen
      title={t('ballKnowledge.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <Segmented options={viewOptions} value={view} onChange={setView} />
      <Segmented options={dimensionOptions} value={dimension} onChange={switchDimension} />

      {/* The concept and the clock, said outright — the user's ask: nobody
          should have to decode what the number or the month means. */}
      <View style={styles.explainer}>
        <Text variant="secondary" color="secondary">
          {t('ballKnowledge.intro')}
        </Text>
        <Text variant="secondary" color="secondary">
          {t('ballKnowledge.fair')}
        </Text>
        <Text variant="secondary" color="tertiary">
          {t('ballKnowledge.season', {month: seasonMonth})}
        </Text>
      </View>

      {!isBackendConfigured ? (
        <Message text={t('leaderboard.unavailable')} />
      ) : view === 'standings' ? (
        <Standings
          board={board}
          dimension={dimension}
          monthLabel={monthLabel}
          onPickFavorite={() => pickFavorite(dimension)}
        />
      ) : (
        <Duel
          duel={duel}
          dimension={dimension}
          sideA={sideA}
          sideB={sideB}
          onPickA={() => pickSide(setSideA)}
          onPickB={() => pickSide(setSideB)}
        />
      )}
    </MenuDetailScreen>
  );
}

function Standings({
  board,
  dimension,
  monthLabel,
  onPickFavorite,
}: {
  board: BoardState;
  dimension: BkDimension;
  monthLabel: (key: string) => string;
  onPickFavorite: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();

  if (board === 'loading') {
    return <Skeleton height={320} accessibilityLabel={t('ballKnowledge.title')} />;
  }
  if (board === 'error') {
    return <Message text={t('leaderboard.loadError')} />;
  }

  const {rows, me, previousWinner} = board;
  const myName = me ? bkGroupName(dimension, me.groupId) : null;

  return (
    <>
      {previousWinner ? (
        <Card style={styles.winner}>
          <Trophy size={16} color={colors.primaryInk} strokeWidth={2} />
          <Text variant="secondary" numberOfLines={1} style={styles.winnerText}>
            {t('ballKnowledge.previousWinner', {
              month: monthLabel(previousWinner.monthKey),
              group: t('ballKnowledge.groupFans', {
                name: bkGroupName(dimension, previousWinner.groupId),
              }),
            })}
          </Text>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Message text={t('ballKnowledge.emptyBoard')} />
      ) : (
        <Card style={styles.boardCard}>
          {rows.map((row, i) => (
            <BkGroupRow
              key={row.groupId}
              row={row}
              dimension={dimension}
              isLast={i === rows.length - 1}
            />
          ))}
        </Card>
      )}

      {me && myName && !me.counted ? (
        <Text variant="caption" color="secondary" style={styles.hint}>
          {t('ballKnowledge.notCounted', {
            count: BK_MIN_PLAYED,
            group: t('ballKnowledge.groupFans', {name: myName}),
          })}
        </Text>
      ) : null}
      {me && myName && me.rank === null ? (
        <Text variant="caption" color="secondary" style={styles.hint}>
          {t('ballKnowledge.belowFloor', {
            count: BK_MIN_MEMBERS,
            group: t('ballKnowledge.groupFans', {name: myName}),
          })}
        </Text>
      ) : null}

      {!me ? (
        <Card style={styles.ctaCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('ballKnowledge.noFavorite')}
          </Text>
          <Button label={t('ballKnowledge.pickFavorite')} onPress={onPickFavorite} />
        </Card>
      ) : null}
    </>
  );
}

function Duel({
  duel,
  dimension,
  sideA,
  sideB,
  onPickA,
  onPickB,
}: {
  duel: DuelState;
  dimension: BkDimension;
  sideA: string | null;
  sideB: string | null;
  onPickA: () => void;
  onPickB: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const loaded = duel !== 'idle' && duel !== 'loading' && duel !== 'error' ? duel : null;
  const aBk = loaded?.a?.bk;
  const bBk = loaded?.b?.bk;

  return (
    <>
      <BkDuelCard
        a={{
          dimension,
          groupId: sideA,
          side: loaded?.a ?? null,
          leading: aBk != null && (bBk == null || aBk > bBk),
          onPress: onPickA,
        }}
        b={{
          dimension,
          groupId: sideB,
          side: loaded?.b ?? null,
          leading: bBk != null && (aBk == null || bBk > aBk),
          onPress: onPickB,
        }}
      />
      {duel === 'loading' ? (
        <Skeleton height={48} accessibilityLabel={t('ballKnowledge.duel')} />
      ) : duel === 'error' ? (
        <Message text={t('leaderboard.loadError')} />
      ) : duel === 'idle' && (!sideA || !sideB) ? (
        <Text variant="caption" color="secondary" style={styles.hint}>
          {t('ballKnowledge.duelHint')}
        </Text>
      ) : null}
    </>
  );
}

function Message({text}: {text: string}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.messageCard}>
      <Text variant="secondary" color="secondary" align="center">
        {text}
      </Text>
    </Card>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.md},
    explainer: {gap: spacing.xs, paddingHorizontal: spacing.xs},
    winner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    winnerText: {flex: 1},
    boardCard: {overflow: 'hidden'},
    hint: {paddingHorizontal: spacing.xs},
    ctaCard: {
      padding: spacing.xl,
      gap: spacing.md,
    },
    messageCard: {padding: spacing.xl},
  });
