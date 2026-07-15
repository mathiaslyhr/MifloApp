/**
 * Friends — the whole friends hub, opened from the Profile header's friends
 * line. Your code to hand out, the search to find or add someone, and the list
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
  getCachedProfile,
  removeFriend,
} from '../../core/social/socialService';
import type {SocialProfile} from '../../core/social/types';
import {useSearch} from '../../games/shared/SearchScreen';
import {ADD_FRIEND_PREFIX, friendSource} from '../../games/shared/searchSources';
import {useSendFriendRequest} from '../social/useSendFriendRequest';
import {CodeBlock} from '../social/CodeBlock';
import {MenuDetailScreen} from '../menu/MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendsList'>;

export function FriendsListScreen({navigation}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [friends, setFriends] = useState<SocialProfile[] | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const openSearch = useSearch();

  const load = useCallback(() => {
    let live = true;
    fetchFriends()
      .then(rows => live && setFriends(rows))
      .catch(() => live && setFriends(prev => prev ?? []));
    // Cache-first: the code never changes, so the card paints immediately and
    // offline rather than waiting on a round trip it doesn't need.
    getCachedProfile().then(p => live && p && setMyCode(p.friendCode));
    return () => {
      live = false;
    };
  }, []);

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
    openSearch(
      // friendSource speaks the feed's shape ({profile}); this page holds bare
      // profiles, so wrap them rather than fetch the whole daily feed again.
      friendSource(
        (friends ?? []).map(profile => ({profile})),
        friend => ({
          id: friend.profile.userId,
          label: friend.profile.displayName,
          avatar: {
            initials: initialsFor(friend.profile.displayName),
            uri: avatarUrlFor(friend.profile.avatarPath),
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
      const friend = (friends ?? []).find(f => f.userId === item.id);
      if (friend) {
        navigation.navigate('FriendProfile', {profile: friend});
      }
    });
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
