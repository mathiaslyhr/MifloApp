/**
 * A friend's profile — the same page shape as the own Profile tab (identity,
 * streaks, log), built from their published results only: score level and
 * streaks, never answers (the wire cannot carry any). The Instagram-style
 * "Friends" status button is where unfriending lives; inviting to a party
 * sits beside it.
 *
 * Streak honesty: published rows carry the streak at publish time, so only
 * today's rows are trusted (matching friendStreak on the Friends tab) — a
 * friend who hasn't played today reads 0, on purpose. The history goes back
 * 14 days, the same window the opt-in backfill can seed.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {ChevronRight, Swords} from 'lucide-react-native';
import {Button, Card, Skeleton, Text, toast} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {isNetworkError} from '../../core/rooms/roomService';
import type {RootStackParamList} from '../../core/navigation';
import {dateKeyFor, pastDateKeys, previousDateKey} from '../../games/scout/dailySeed';
import {DAILY_GAMES} from '../../core/daily/dailyLog';
import {presenceFor} from '../../core/social/presence';
import {
  avatarUrlFor,
  fetchFriendCount,
  fetchFriendResults,
  removeFriend,
} from '../../core/social/socialService';
import type {PublishedResult} from '../../core/social/types';
import {inviteFriendToParty} from '../social/inviteToParty';
import {MenuDetailScreen} from '../menu/MenuDetailScreen';
import {ProfileHeader} from './ProfileHeader';
import {FavoritesShowcase} from './FavoritesShowcase';
import {StreaksSection} from './StreaksSection';
import {HistorySection, type HistoryDay} from './HistorySection';

/** The log window: today plus the 13 days before it. */
const LOG_DAYS = 14;

type Props = NativeStackScreenProps<RootStackParamList, 'FriendProfile'>;

export function FriendProfileScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const {profile} = route.params;
  const todayKey = useMemo(() => dateKeyFor(new Date()), []);

  const [results, setResults] = useState<PublishedResult[] | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const fromKey = pastDateKeys(todayKey, LOG_DAYS - 1).at(-1) ?? todayKey;
      fetchFriendResults(profile.userId, fromKey)
        .then(rows => {
          if (live) {
            setResults(rows);
          }
        })
        .catch(err => {
          if (live) {
            toast.error(
              isNetworkError(err) ? t('common.errorNetwork') : t('social.loadError'),
            );
            setResults(prev => prev ?? []);
          }
        });
      // Absent quietly when unknown (or the RPC isn't deployed yet).
      fetchFriendCount(profile.userId).then(count => {
        if (live) {
          setFriendCount(count);
        }
      });
      return () => {
        live = false;
      };
    }, [profile.userId, t, todayKey]),
  );

  function confirmRemove() {
    Alert.alert(
      t('social.removeTitle'),
      t('social.removeBody', {name: profile.displayName}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            removeFriend(profile.userId)
              .then(() => navigation.goBack())
              .catch(() => toast.error(t('common.errorNetwork')));
          },
        },
      ],
    );
  }

  async function invite() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await inviteFriendToParty(navigation, profile, t);
    } finally {
      setBusy(false);
    }
  }

  // Only today's published rows carry a live streak; no "best" ever crosses
  // the wire, so the grid shows current-only (the caption stays hidden).
  const streakCells = DAILY_GAMES.map(game => ({
    game,
    current:
      results?.find(r => r.dateKey === todayKey && r.game === game)?.streak ?? 0,
  }));

  // Today-anchored day cards, matching the own profile's buildDailyLog: always
  // lead with Today (notPlayed if the friend hasn't played), then walk back to
  // their earliest published day. Rows dated after today (a friend in a
  // timezone ahead can publish tomorrow's key) are ignored so today stays on
  // top and never reads as a second card.
  const historyDays: HistoryDay[] = useMemo(() => {
    if (!results) {
      return [];
    }
    const byDay = new Map<string, PublishedResult[]>();
    let earliest = todayKey;
    for (const row of results) {
      if (row.dateKey > todayKey) {
        continue;
      }
      const list = byDay.get(row.dateKey) ?? [];
      list.push(row);
      byDay.set(row.dateKey, list);
      if (row.dateKey < earliest) {
        earliest = row.dateKey;
      }
    }

    const days: HistoryDay[] = [];
    for (let key = todayKey; ; key = previousDateKey(key)) {
      const rows = byDay.get(key) ?? [];
      days.push({
        dateKey: key,
        rows: DAILY_GAMES.map(game => {
          const row = rows.find(r => r.game === game);
          return {
            game,
            status: row?.status ?? ('notPlayed' as const),
            // The wire carries wrong in `score`, right in `total` (Part C). Old
            // rows predate `total` and read back null → shown as 0 right.
            right: row ? (row.total ?? 0) : null,
            wrong: row?.score ?? null,
            answer: null,
          };
        }),
      });
      if (key <= earliest) {
        break;
      }
    }
    return days;
  }, [results, todayKey]);

  return (
    <MenuDetailScreen
      title={profile.displayName}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <ProfileHeader
        name={profile.displayName}
        tone="soft"
        showName={false}
        friendCount={friendCount}
        avatarUri={avatarUrlFor(profile.avatarPath)}
        presence={presenceFor(profile.lastSeenAt, Date.now())}>
        {/* Instagram's Following/Message pair: the quiet status button hides
            the remove behind a confirm; the invite is the page's one primary. */}
        <View style={styles.action}>
          <Button
            label={t('profile.friendsButton')}
            variant="secondary"
            onPress={confirmRemove}
          />
        </View>
        <View style={styles.action}>
          <Button
            label={t('invite.invite')}
            variant="primary"
            onPress={invite}
            disabled={busy}
          />
        </View>
      </ProfileHeader>

      <FavoritesShowcase
        favorites={{
          playerId: profile.favoritePlayerId,
          clubId: profile.favoriteClubId,
          nation: profile.favoriteNation,
        }}
      />

      <Card style={styles.h2hCard}>
        <Pressable
          onPress={() => navigation.navigate('HeadToHead', {profile})}
          accessibilityRole="button"
          style={styles.h2hRow}>
          <Swords size={18} color={colors.ink} strokeWidth={2} />
          <Text variant="body" style={styles.h2hLabel}>
            {t('headToHead.title')}
          </Text>
          <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
        </Pressable>
      </Card>

      {results === null ? (
        <Skeleton height={168} />
      ) : (
        <>
          <StreaksSection cells={streakCells} />
          <HistorySection
            days={historyDays}
            todayKey={todayKey}
            emptyLabel={t('profile.friendLogEmpty')}
          />
        </>
      )}
    </MenuDetailScreen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.lg},
    // Half-width buttons side by side (the Following/Message row).
    action: {flex: 1},
    // The Head-to-head entry point: a quiet tappable row into the record page.
    h2hCard: {paddingHorizontal: spacing.lg, paddingVertical: spacing.xs},
    h2hRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    h2hLabel: {flex: 1, color: c.ink},
  });
