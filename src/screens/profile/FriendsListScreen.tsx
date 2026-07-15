/**
 * Friends — the whole friends hub, opened from a profile header's friends stat.
 * Your code to hand out, the search to find or add someone, and the list
 * itself; tap a row for that friend's profile, swipe right to remove.
 *
 * Deliberately NOT a daily feed: Home already shows how friends did today, so
 * repeating it here would be the same answer twice. This page answers "who are
 * my friends?" — for "how did they do?", open one.
 *
 * The search does both jobs at once: typing a name filters the list, while a
 * query spelling an unknown friend code turns into a "send request" tile.
 * Adding a friend IS searching for them, and this is the only route to
 * add-by-code, so it can never be reduced to a plain filter.
 *
 * With a `userId` param this is instead A FRIEND'S list, the Instagram move:
 * browse who they know and go look at those people. It's the same page with
 * everything personal taken out — your code, add-by-code and swipe-to-remove
 * are all about YOUR friendships and mean nothing on someone else's list. Rows
 * carry your own relation to each person (friends_of, 0043), so a mutual opens
 * their real profile and everyone else opens a stranger page.
 */
import React, {useCallback, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import type {ScrollView} from 'react-native-gesture-handler';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {ChevronRight, Search, X} from 'lucide-react-native';
import {
  Avatar,
  Card,
  PressableScale,
  Skeleton,
  SwipeReveal,
  Text,
  initialsFor,
  toast,
} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {presenceFor} from '../../core/social/presence';
import {
  avatarUrlFor,
  fetchFriends,
  fetchFriendsOf,
  getCachedProfile,
  removeFriend,
  searchProfiles,
} from '../../core/social/socialService';
import {isNetworkError} from '../../core/rooms/roomService';
import type {DirectoryPerson, SocialProfile} from '../../core/social/types';
import {useSearch} from '../../games/shared/SearchScreen';
import {ADD_FRIEND_PREFIX, peopleSource} from '../../games/shared/searchSources';
import {useSendFriendRequest} from '../social/useSendFriendRequest';
import {CodeBlock} from '../social/CodeBlock';
import {MenuDetailScreen} from '../menu/MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendsList'>;

export function FriendsListScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // No params = my own list. A userId = someone else's, read-only.
  const ofUserId = route.params?.userId ?? null;
  const ofName = route.params?.name ?? '';
  const [friends, setFriends] = useState<SocialProfile[] | null>(null);
  const [people, setPeople] = useState<DirectoryPerson[] | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const openSearch = useSearch();

  const load = useCallback(() => {
    let live = true;
    if (ofUserId) {
      fetchFriendsOf(ofUserId)
        .then(rows => live && setPeople(rows))
        .catch(err => {
          if (live) {
            toast.error(
              isNetworkError(err) ? t('common.errorNetwork') : t('social.loadError'),
            );
            setPeople(prev => prev ?? []);
          }
        });
      return () => {
        live = false;
      };
    }
    fetchFriends()
      .then(rows => live && setFriends(rows))
      .catch(() => live && setFriends(prev => prev ?? []));
    // Cache-first: the code never changes, so the card paints immediately and
    // offline rather than waiting on a round trip it doesn't need.
    getCachedProfile().then(p => live && p && setMyCode(p.friendCode));
    return () => {
      live = false;
    };
  }, [ofUserId, t]);

  // Refetch each time the page is looked at, so a removal on a friend's profile
  // (or a new accept) is reflected on the way back.
  useFocusEffect(load);

  const {send} = useSendFriendRequest({onFriendAdded: load});

  /** Confirm, then remove optimistically — the server stays the truth. */
  function confirmRemove(friend: SocialProfile) {
    Alert.alert(t('social.removeTitle'), t('social.removeBody', {name: friend.displayName}), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => {
          const before = friends;
          setFriends(prev => (prev ? prev.filter(f => f.userId !== friend.userId) : prev));
          removeFriend(friend.userId).catch(() => {
            setFriends(before);
            toast.error(t('common.errorNetwork'));
          });
        },
      },
    ]);
  }

  function openFriendSearch() {
    // Whoever the search turns up has to be findable again when a tile is
    // picked, and only the grid knows which tile that was — so remember every
    // person the field has seen this session.
    const seen = new Map<string, DirectoryPerson>();
    for (const profile of friends ?? []) {
      seen.set(profile.userId, {
        userId: profile.userId,
        displayName: profile.displayName,
        avatarPath: profile.avatarPath,
        isFriend: true,
      });
    }
    openSearch(
      peopleSource(
        friends ?? [],
        async query => {
          const rows = await searchProfiles(query);
          for (const row of rows) {
            seen.set(row.userId, row);
          }
          return rows;
        },
        person => ({
          id: person.userId,
          label: person.displayName,
          avatar: {
            initials: initialsFor(person.displayName),
            uri: avatarUrlFor(person.avatarPath),
          },
        }),
        code => t('social.sendRequestTo', {code}),
      ),
      {placeholder: t('social.searchPlaceholder'), autoCapitalize: 'none'},
    ).then(item => {
      if (!item) {
        return;
      }
      if (item.id.startsWith(ADD_FRIEND_PREFIX)) {
        send(item.id.slice(ADD_FRIEND_PREFIX.length));
        return;
      }
      const person = seen.get(item.id);
      if (!person) {
        return;
      }
      // A friend opens their real page; anyone else opens their stranger page,
      // which is where Add friend lives. Searching for someone and adding them
      // is one road, not two.
      const friend = (friends ?? []).find(f => f.userId === person.userId);
      navigation.navigate('FriendProfile', {
        profile: friend ?? {
          userId: person.userId,
          displayName: person.displayName,
          avatarPath: person.avatarPath,
          friendCode: '',
          lastSeenAt: null,
          favoritePlayerId: null,
          favoriteClubId: null,
          favoriteNation: null,
        },
        relation: person.isFriend ? 'friend' : 'stranger',
      });
    });
  }

  // Someone else's list: browsable, never editable.
  if (ofUserId) {
    return (
      <MenuDetailScreen
        title={t('profile.friendsOfTitle', {name: ofName})}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        scrollRef={scrollRef}
        contentStyle={styles.body}>
        {people === null ? (
          <Skeleton height={160} />
        ) : people.length === 0 ? (
          <Card style={styles.messageCard}>
            <Text variant="secondary" color="secondary" align="center">
              {t('social.empty')}
            </Text>
          </Card>
        ) : (
          people.map(person => (
            <PressableScale
              key={person.userId}
              onPress={() =>
                navigation.push('FriendProfile', {
                  // A directory row knows a name and a face; the page it opens
                  // fetches the rest. The blanks are honest: a friend-of-friend
                  // has no code or presence we're allowed to know.
                  profile: {
                    userId: person.userId,
                    displayName: person.displayName,
                    avatarPath: person.avatarPath,
                    friendCode: '',
                    lastSeenAt: null,
                    favoritePlayerId: null,
                    favoriteClubId: null,
                    favoriteNation: null,
                  },
                  relation: person.isFriend ? 'friend' : 'stranger',
                })
              }
              accessibilityRole="button"
              accessibilityLabel={person.displayName}>
              <Card style={styles.row}>
                <Avatar
                  initials={initialsFor(person.displayName)}
                  tone="soft"
                  size={44}
                  uri={avatarUrlFor(person.avatarPath)}
                />
                <Text variant="label" numberOfLines={1} style={styles.name}>
                  {person.displayName}
                </Text>
                <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
              </Card>
            </PressableScale>
          ))
        )}
      </MenuDetailScreen>
    );
  }

  return (
    <MenuDetailScreen
      title={t('profile.friendsButton')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      scrollRef={scrollRef}
      contentStyle={styles.body}>
      {/* Your code lives here because handing it to someone is the only thing
          it's for, and this is the page you're on when you do. */}
      {myCode ? (
        <Card style={styles.codeCard}>
          <CodeBlock code={myCode} divider={false} />
        </Card>
      ) : null}

      {/* A search bar that opens the real search, iOS-style: it looks like the
          field it summons, so the affordance reads before it's tapped. */}
      <PressableScale
        onPress={openFriendSearch}
        accessibilityRole="search"
        accessibilityLabel={t('social.searchA11y')}>
        <Card style={styles.searchBar}>
          <Search size={16} color={colors.textTertiary} strokeWidth={2} />
          <Text variant="body" color="tertiary" numberOfLines={1}>
            {t('social.searchPlaceholder')}
          </Text>
        </Card>
      </PressableScale>

      {friends === null ? (
        <Skeleton height={160} />
      ) : friends.length === 0 ? (
        <Card style={styles.messageCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('social.empty')}
          </Text>
        </Card>
      ) : (
        friends.map(friend => {
          const presence = presenceFor(friend.lastSeenAt, Date.now());
          return (
            <SwipeReveal
              key={friend.userId}
              Icon={X}
              destructive
              label={t('common.remove')}
              onAction={() => confirmRemove(friend)}
              actionAccessibilityLabel={t('social.removeA11y', {name: friend.displayName})}
              scrollRef={scrollRef}>
              <PressableScale
                onPress={() => navigation.navigate('FriendProfile', {profile: friend})}
                accessibilityRole="button"
                accessibilityLabel={friend.displayName}>
                <Card style={styles.row}>
                  <View>
                    <Avatar
                      initials={initialsFor(friend.displayName)}
                      tone="soft"
                      size={44}
                      uri={avatarUrlFor(friend.avatarPath)}
                    />
                    {presence.online ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <Text variant="label" numberOfLines={1} style={styles.name}>
                    {friend.displayName}
                  </Text>
                  <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
                </Card>
              </PressableScale>
            </SwipeReveal>
          );
        })
      )}
    </MenuDetailScreen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.sm},
    codeCard: {paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    messageCard: {padding: spacing.xl},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    name: {flex: 1},
    // Presence dot pinned to the avatar corner, rimmed in the card surface so
    // it reads as lifted off it (same recipe as PersonCard).
    onlineDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.success,
      borderWidth: 2,
      borderColor: c.surface,
    },
  });
