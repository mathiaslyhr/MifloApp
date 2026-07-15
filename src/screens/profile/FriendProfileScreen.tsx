/**
 * Someone else's profile — deliberately the same page as your own Profile tab,
 * in the same order: identity, favourites, then a Daily | Career segment. What
 * you can see about yourself, you can see about a friend, so there is nothing
 * to learn twice. The differences are structural:
 *
 *   * The header carries the Instagram-style status pair (the quiet "Friends"
 *     button is where unfriending lives, the invite is the page's one primary),
 *     where your own header carries a rename.
 *   * Nothing is editable, and no empty state offers an action on their behalf.
 *
 * A STRANGER (someone met by browsing a friend's friends) gets the same page
 * with its doors shut: name, avatar, favourites and one Add friend button. No
 * career, no dailies, no presence — those are things you earn by being friends,
 * and the server agrees (rh_friend_career and daily_results both refuse), so
 * this page doesn't even ask for them.
 *
 * `relation` from the route is only a paint hint. public_profile (0043) is the
 * authority and is re-read on every visit, because you may have accepted their
 * request in the seconds since the tap.
 *
 * Career comes from rh_friend_career (0042) — the friend-gated twin of the own
 * page's rh_match_history, since RLS keeps both rating_events and
 * player_ratings select-own. Daily is built from their published results only:
 * score level and streaks, never answers (the wire cannot carry any).
 *
 * Streak honesty: published rows carry the streak at publish time, so only
 * today's rows are trusted (matching friendStreak on the Friends tab) — a
 * friend who hasn't played today reads 0, on purpose. The history goes back
 * 14 days, the same window the opt-in backfill can seed.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {
  Button,
  Card,
  Segmented,
  Skeleton,
  Text,
  toast,
  type SegmentedOption,
} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {spacing, useThemedStyles, type Palette} from '../../theme';
import {isNetworkError} from '../../core/rooms/roomService';
import type {RootStackParamList} from '../../core/navigation';
import {dateKeyFor, pastDateKeys, previousDateKey} from '../../games/scout/dailySeed';
import {DAILY_GAMES} from '../../core/daily/dailyLog';
import {presenceFor} from '../../core/social/presence';
import {
  avatarUrlFor,
  fetchFriendResults,
  fetchPublicProfile,
  removeFriend,
  sendFriendPush,
  sendFriendRequestByUserId,
} from '../../core/social/socialService';
import {requestPushPermissionAndSync} from '../../core/notifications/pushInvites';
import {fetchFriendCareer, type FriendCareer} from '../../core/rooms/rankedService';
import {EMPTY_HISTORY} from '../../games/ranked-hattrick/history';
import type {PublicProfile, PublishedResult} from '../../core/social/types';
import {inviteFriendToParty} from '../social/inviteToParty';
import {MenuDetailScreen} from '../menu/MenuDetailScreen';
import {ProfileHeader} from './ProfileHeader';
import {FavoritesShowcase} from './FavoritesShowcase';
import {StreaksSection} from './StreaksSection';
import {HistorySection, type HistoryDay} from './HistorySection';
import {CareerSection} from './CareerSection';

/** The log window: today plus the 13 days before it. */
const LOG_DAYS = 14;

/** The same two segments the own Profile tab has, and in the same order. */
type Segment = 'daily' | 'career';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendProfile'>;

export function FriendProfileScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const {profile, relation = 'friend'} = route.params;
  const todayKey = useMemo(() => dateKeyFor(new Date()), []);

  const [segment, setSegment] = useState<Segment>('daily');
  const [results, setResults] = useState<PublishedResult[] | null>(null);
  const [career, setCareer] = useState<FriendCareer | null>(null);
  const [pub, setPub] = useState<PublicProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);

  // The route's hint paints frame one; the server corrects it a moment later.
  const isFriend = pub?.isFriend ?? relation === 'friend';

  useFocusEffect(
    useCallback(() => {
      let live = true;
      // Always: the one read that works for friend and stranger alike, and the
      // only thing that can say which of the two this is.
      fetchPublicProfile(profile.userId)
        .then(p => {
          if (live && p) {
            setPub(p);
          }
        })
        .catch(() => {
          // Quiet: the route's hint already painted a usable page.
        });

      // Everything below is friends-only on the server too, so a stranger's
      // page doesn't ask — an error toast for a rule we already know is noise.
      if (relation !== 'friend') {
        return () => {
          live = false;
        };
      }

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
      // One round trip for the whole career, the same bargain the own page
      // makes. On failure the toast is what tells the truth and the section
      // falls back to its empty state, rather than a skeleton that never ends.
      fetchFriendCareer(profile.userId)
        .then(c => {
          if (live) {
            setCareer(c);
          }
        })
        .catch(err => {
          if (live) {
            toast.error(
              isNetworkError(err) ? t('common.errorNetwork') : t('social.loadError'),
            );
            setCareer(prev => prev ?? {value: null, history: EMPTY_HISTORY});
          }
        });
      return () => {
        live = false;
      };
    }, [profile.userId, relation, t, todayKey]),
  );

  /** Ask to be friends. By user id (0033), because a stranger's code is
   * deliberately not something this page is ever told. Same four outcomes the
   * lobby's add handles, spelled the same way. */
  async function addFriend() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const {outcome, friend} = await sendFriendRequestByUserId(profile.userId);
      const name = friend.displayName || profile.displayName;
      switch (outcome) {
        case 'requested':
          haptics.success();
          toast.success(t('social.requestSent', {name}));
          sendFriendPush('friend_request', profile.userId).catch(() => {});
          setRequested(true);
          break;
        case 'autoAccepted':
          // Their pending ask + ours fused into a friendship on the spot, so
          // this page becomes a friend's page under our feet.
          haptics.success();
          toast.success(t('social.friendAdded', {name}));
          sendFriendPush('request_accepted', profile.userId).catch(() => {});
          setPub(prev => (prev ? {...prev, isFriend: true} : prev));
          break;
        case 'alreadyRequested':
          toast.neutral(t('social.requestAlreadySent', {name}));
          setRequested(true);
          break;
        case 'alreadyFriends':
          toast.neutral(t('social.alreadyFriends', {name}));
          setPub(prev => (prev ? {...prev, isFriend: true} : prev));
          break;
      }
      // Sending is also when this phone becomes push-reachable for the reply.
      requestPushPermissionAndSync().catch(() => {});
    } catch (err) {
      haptics.error();
      toast.error(
        isNetworkError(err) ? t('common.errorNetwork') : t('social.errorRequest'),
      );
    } finally {
      setBusy(false);
    }
  }

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

  const segments: SegmentedOption<Segment>[] = [
    {key: 'daily', label: t('profile.segmentDailies')},
    {key: 'career', label: t('profile.segmentCareer')},
  ];

  // Favourites come from public_profile once it lands (a friend-of-friend row
  // carries only a name and a face), with the route's profile painting first.
  const favorites = {
    playerId: pub?.favoritePlayerId ?? profile.favoritePlayerId,
    clubId: pub?.favoriteClubId ?? profile.favoriteClubId,
    nation: pub?.favoriteNation ?? profile.favoriteNation,
  };

  return (
    <MenuDetailScreen
      title={t('tabs.profile')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <ProfileHeader
        name={pub?.displayName ?? profile.displayName}
        tone="soft"
        friendCount={pub?.friendCount ?? null}
        // Browsing on is a friend's privilege: friends_of refuses a stranger's
        // list, so the stat must not offer a door that won't open.
        onPressFriends={
          isFriend
            ? () =>
                navigation.navigate('FriendsList', {
                  userId: profile.userId,
                  name: pub?.displayName ?? profile.displayName,
                })
            : undefined
        }
        avatarUri={avatarUrlFor(pub?.avatarPath ?? profile.avatarPath)}
        // Presence is friend-scoped; a stranger's row never carries it.
        presence={
          isFriend ? presenceFor(profile.lastSeenAt, Date.now()) : undefined
        }>
        {isFriend ? (
          <>
            {/* Instagram's Following/Message pair: the quiet status button hides
                the remove behind a confirm; the invite is the one primary. */}
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
          </>
        ) : (
          <View style={styles.action}>
            <Button
              label={
                requested ? t('profile.friendRequested') : t('profile.addFriend')
              }
              variant="primary"
              onPress={addFriend}
              disabled={busy || requested}
            />
          </View>
        )}
      </ProfileHeader>

      {/* Above the segments, with the avatar and the name — favourites are
          identity, exactly as on the own page. Read-only here: they're theirs.
          A stranger gets these too: a showcase is made to be shown. */}
      <FavoritesShowcase favorites={favorites} />

      {!isFriend ? (
        <Card style={styles.lockedCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('profile.strangerLocked', {
              name: pub?.displayName ?? profile.displayName,
            })}
          </Text>
        </Card>
      ) : (
        <>
          <Segmented options={segments} value={segment} onChange={setSegment} />

          {segment === 'career' ? (
            <CareerSection
              history={career?.history ?? null}
              value={career?.value ?? null}
              todayKey={todayKey}
              empty={{kind: 'friend', name: profile.displayName}}
            />
          ) : results === null ? (
            <Skeleton height={168} />
          ) : (
            <View style={styles.body}>
              <StreaksSection cells={streakCells} />
              <HistorySection
                days={historyDays}
                todayKey={todayKey}
                emptyLabel={t('profile.friendLogEmpty')}
              />
            </View>
          )}
        </>
      )}
    </MenuDetailScreen>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.lg},
    // Half-width buttons side by side (the Following/Message row).
    action: {flex: 1},
    // The shut door on a stranger's page: says what friendship would open.
    lockedCard: {padding: spacing.xl},
  });
