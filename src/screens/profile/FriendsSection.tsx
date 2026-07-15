/**
 * Friends — everything the retired Friends tab used to hold, now a segment of
 * the Profile page. Pending requests first (they need an answer), then the
 * friend cards showing how everyone did in today's dailies; tap opens a
 * friend's profile, swipe right removes.
 *
 * Adding and finding stay the same gesture: the search opens the shared grid,
 * where a name filters the list and a query spelling an unknown friend code
 * becomes a "send request" tile. There is no separate "add friend" button
 * because there is no separate act.
 *
 * With the Friends tab gone, discovery moved to the shell: a pending request
 * badges the Profile tab (TabsScreen → IslandTabBar), which is why this section
 * never has to shout for attention.
 */
import React, {useCallback, useEffect, useRef} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import type {ScrollView} from 'react-native-gesture-handler';
import {useTranslation} from 'react-i18next';
import {Clock, X} from 'lucide-react-native';
import {
  Card,
  Skeleton,
  SwipeReveal,
  Text,
  initialsFor,
  toast,
} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {isBackendConfigured} from '../../core/config';
import {useAppNavigation} from '../../core/navigation';
import {presenceFor} from '../../core/social/presence';
import {useRequestsStore} from '../../core/social/requestsStore';
import {avatarUrlFor, removeFriend} from '../../core/social/socialService';
import type {FriendFeed, SocialProfile} from '../../core/social/types';
import {PersonCard, friendCellsFor, friendStreak} from '../social/PersonCard';
import {RequestsSection} from '../social/RequestsSection';
import {useSearch} from '../../games/shared/SearchScreen';
import {ADD_FRIEND_PREFIX, friendSource} from '../../games/shared/searchSources';
import {useSendFriendRequest} from '../social/useSendFriendRequest';

type Props = {
  feed: FriendFeed[] | null;
  setFeed: React.Dispatch<React.SetStateAction<FriendFeed[] | null>>;
  refreshFeed: () => void;
  todayKey: string;
  scrollRef: React.RefObject<ScrollView | null>;
  /** A friend code from the miflo.dk/add/CODE deep link — auto-sent once. */
  addCode?: string;
  /** Registers the search opener so the page header's button can fire it. */
  onSearchReady: (open: () => void) => void;
};

export function FriendsSection({
  feed,
  setFeed,
  refreshFeed,
  todayKey,
  scrollRef,
  addCode,
  onSearchReady,
}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const navigation = useAppNavigation();
  const requests = useRequestsStore(s => s.requests);
  const openSearch = useSearch();

  const {send} = useSendFriendRequest({onFriendAdded: refreshFeed});

  // The search button lives on the page header (one corner, shared with the
  // menu), so the opener is handed up rather than rendered here.
  const openFriendSearch = useCallback(() => {
    openSearch(
      friendSource(
        feed ?? [],
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
      const friend = (feed ?? []).find(f => f.profile.userId === item.id);
      if (friend) {
        navigation.navigate('FriendProfile', {profile: friend.profile});
      }
    });
  }, [feed, openSearch, navigation, send, t]);

  useEffect(() => {
    onSearchReady(openFriendSearch);
  }, [openFriendSearch, onSearchReady]);

  // A shared friend-code link lands here with `addCode`: send it once, as soon
  // as there's a profile to send it from. Each code value fires exactly once.
  const consumedAddCode = useRef<string | null>(null);
  useEffect(() => {
    if (!addCode || consumedAddCode.current === addCode) {
      return;
    }
    consumedAddCode.current = addCode;
    send(addCode.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addCode]);

  /** Swipe action: confirm, then remove optimistically (the server is truth). */
  function confirmRemove(friend: SocialProfile) {
    Alert.alert(t('social.removeTitle'), t('social.removeBody', {name: friend.displayName}), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => {
          const before = feed;
          setFeed(prev => (prev ? prev.filter(f => f.profile.userId !== friend.userId) : prev));
          removeFriend(friend.userId).catch(() => {
            setFeed(before);
            toast.error(t('common.errorNetwork'));
          });
        },
      },
    ]);
  }

  if (!isBackendConfigured) {
    return (
      <Card style={styles.messageCard}>
        <Text variant="secondary" color="secondary" align="center">
          {t('social.unavailable')}
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.section}>
      <RequestsSection requests={requests?.incoming ?? []} onAccepted={refreshFeed} />

      {feed === null ? (
        <Skeleton height={140} />
      ) : (
        <View style={styles.list}>
          <Text variant="caption" color="tertiary" style={styles.eyebrow}>
            {t('social.friendsDailyEyebrow').toUpperCase()}
          </Text>
          {feed.length === 0 ? (
            <Card style={styles.messageCard}>
              <Text variant="secondary" color="secondary" align="center">
                {t('social.empty')}
              </Text>
            </Card>
          ) : (
            feed.map(friend => (
              <SwipeReveal
                key={friend.profile.userId}
                Icon={X}
                destructive
                label={t('common.remove')}
                onAction={() => confirmRemove(friend.profile)}
                actionAccessibilityLabel={t('social.removeA11y', {
                  name: friend.profile.displayName,
                })}
                scrollRef={scrollRef}>
                <PersonCard
                  name={friend.profile.displayName}
                  avatarUri={avatarUrlFor(friend.profile.avatarPath)}
                  presence={presenceFor(friend.profile.lastSeenAt, Date.now())}
                  streak={friendStreak(friend.results, todayKey)}
                  today={friendCellsFor(friend.results, todayKey)}
                  onPress={() =>
                    navigation.navigate('FriendProfile', {profile: friend.profile})
                  }
                />
              </SwipeReveal>
            ))
          )}
          {/* Requests we sent that still await an answer — quiet captions, not
              cards; the other side owns the next move. */}
          {(requests?.outgoing ?? []).map(request => (
            <View key={request.profile.userId} style={styles.pendingRow}>
              <Clock size={12} color={colors.muted} strokeWidth={2} />
              <Text variant="caption" color="tertiary" numberOfLines={1}>
                {t('social.requestPending', {name: request.profile.displayName})}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    section: {gap: spacing.lg},
    list: {gap: spacing.sm},
    eyebrow: {letterSpacing: 1, marginLeft: spacing.md},
    messageCard: {padding: spacing.xl},
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
  });
