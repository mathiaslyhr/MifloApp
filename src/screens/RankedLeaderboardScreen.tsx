/**
 * The ranked board — Competitive's leaderboard, reached from the Play tab.
 *
 * A transfer-market rich list: everyone who has played ranked Hattrick, sorted
 * by the one currency the mode has (€ value), with each row's divider doubling
 * as a bar showing their share of the leader's. Two scopes off one Segmented —
 * everyone, or just you and your friends ranked among yourselves.
 *
 * The board shows BOARD_LIMIT places; if you're below that your row pins under
 * it with the € still needed to climb in, which is the only number on this page
 * that's actually actionable.
 *
 * Fetches per scope on mount and on switch. No realtime and no cache: a board
 * only moves as matches finish, and a revisit refetches (see fetchLeaderboard).
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Card, Segmented, Skeleton, Text, type SegmentedOption} from '../core/ui';
import {spacing, useThemedStyles, type Palette} from '../theme';
import {isBackendConfigured} from '../core/config';
import type {RootStackParamList} from '../core/navigation';
import {avatarUrlFor} from '../core/social/socialService';
import {fetchLeaderboard, BOARD_LIMIT} from '../core/rooms/rankedService';
import type {BoardScope, RankedBoard} from '../core/rooms/rankedService';
import {gapToTop} from '../games/ranked-hattrick/board';
import {MenuDetailScreen} from './menu/MenuDetailScreen';
import {RankedBoardRow} from './ranked/RankedBoardRow';

type Props = NativeStackScreenProps<RootStackParamList, 'RankedLeaderboard'>;

type State = 'loading' | 'error' | RankedBoard;

export function RankedLeaderboardScreen({navigation}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [scope, setScope] = useState<BoardScope>('world');
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!isBackendConfigured) {
      return;
    }
    let live = true;
    setState('loading');
    fetchLeaderboard(scope)
      .then(board => {
        if (live) {
          setState(board);
        }
      })
      .catch(() => {
        // No toast: the inline row explains it, and a network blip on a passive
        // board doesn't warrant one.
        if (live) {
          setState('error');
        }
      });
    return () => {
      live = false;
    };
  }, [scope]);

  const options: SegmentedOption<BoardScope>[] = [
    {key: 'world', label: t('leaderboard.worldwide')},
    {key: 'friends', label: t('leaderboard.friends')},
  ];

  return (
    <MenuDetailScreen
      title={t('rankedBoard.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <Segmented options={options} value={scope} onChange={setScope} />

      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t(scope === 'world' ? 'rankedBoard.eyebrowWorld' : 'rankedBoard.eyebrowFriends').toUpperCase()}
      </Text>

      {!isBackendConfigured ? (
        <Message text={t('leaderboard.unavailable')} />
      ) : state === 'loading' ? (
        <Skeleton height={320} accessibilityLabel={t('rankedBoard.title')} />
      ) : state === 'error' ? (
        <Message text={t('leaderboard.loadError')} />
      ) : state.rows.length === 0 ? (
        <Message
          text={t(scope === 'world' ? 'rankedBoard.emptyWorld' : 'rankedBoard.emptyFriends')}
        />
      ) : (
        <Board board={state} onFindMatch={() => navigation.navigate('RankedSearch')} />
      )}
    </MenuDetailScreen>
  );
}

function Board({board, onFindMatch}: {board: RankedBoard; onFindMatch: () => void}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const {rows, me} = board;

  const meInList = rows.some(r => r.isMe);
  // The gap only means something against the last place actually on screen: with
  // fewer than BOARD_LIMIT players nobody is "outside the top 10".
  const lastShown = rows[rows.length - 1];
  const gap = me && rows.length >= BOARD_LIMIT ? gapToTop(me.value, lastShown.value) : null;

  return (
    <Card style={styles.board}>
      {/* Whatever follows the slice (a pinned row, the not-rated prompt) brings
          its own top rule, so the last row never carries a bottom one. */}
      {rows.map((row, i) => (
        <RankedBoardRow
          key={i}
          rank={row.rank}
          name={row.displayName}
          avatarUri={avatarUrlFor(row.avatarPath)}
          value={row.value}
          played={row.played}
          wins={row.wins}
          draws={row.draws}
          losses={row.losses}
          you={row.isMe}
          isLast={i === rows.length - 1}
        />
      ))}

      {/* Pin the caller's own place when it sits below the visible slice. */}
      {me && !meInList ? (
        <View style={styles.pinned}>
          <RankedBoardRow
            rank={me.rank}
            name={null}
            value={me.value}
            played={me.played}
            wins={me.wins}
            draws={me.draws}
            losses={me.losses}
            you
            gap={gap}
            isLast
          />
        </View>
      ) : null}

      {/* Never rated: there's no row to pin, so offer the way onto the board. */}
      {!me ? (
        <View style={styles.prompt}>
          <Text variant="secondary" color="secondary" align="center">
            {t('rankedBoard.notRanked')}
          </Text>
          <Button label={t('play.findMatch')} onPress={onFindMatch} />
        </View>
      ) : null}
    </Card>
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // No paddingHorizontal: Screen already applies screenPadding (padded
    // defaults true), and adding it here inset the board twice over.
    body: {gap: spacing.md},
    eyebrow: {letterSpacing: 1, paddingHorizontal: spacing.xs},
    messageCard: {padding: spacing.xl},
    // The rows own their side padding so each bar can reach the card's edge;
    // overflow clips the fills back to the card radius (Card leaves both to the
    // call site).
    board: {overflow: 'hidden'},
    // A stronger rule sets the pinned row apart from the slice above it. The
    // pinned RankedBoardRow brings its own side padding; only the prompt below
    // needs any here.
    pinned: {
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    // The not-rated prompt isn't a row, so it pads itself.
    prompt: {
      borderTopWidth: 1,
      borderTopColor: c.divider,
      padding: spacing.lg,
      gap: spacing.md,
    },
  });
