/**
 * Friends — the social tab, and the app's ONE friends list. Shows how your
 * friends did in today's daily games (score level only, never answers) so
 * nobody has to text screenshots around anymore.
 *
 * No accounts: identity is the app's anonymous session. Opting in creates a
 * profile with a chosen display name (deliberately separate from the random
 * per-room party names) and a permanent shareable friend code. Typing a
 * friend's code sends a REQUEST they accept or decline (0024); the answer
 * arrives as a push.
 *
 * Layout: pending requests only when there are any, then the friend cards
 * (tap opens the friend's profile, swipe right reveals remove). The corner
 * search button is the tab's one utility: typing filters friends by name or
 * code, and a query that spells an unknown friend code becomes a
 * "send request" card — adding and finding are the same gesture. Your own
 * identity, code and results live on the Profile tab.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
// gesture-handler's ScrollView, not RN's: the swipe-reveal pan claims
// priority over it via blocksExternalGesture (see GamesScreen).
import {ScrollView} from 'react-native-gesture-handler';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {Clock, Search, X} from 'lucide-react-native';
import {
  Button,
  CircleButton,
  GlassCard,
  GlassTag,
  initialsFor,
  NAV_HEIGHT,
  Screen,
  Skeleton,
  Text,
  TextField,
  toast,
  TopStatusFade,
  closeOpenSwipeReveal,
  SwipeReveal,
} from '../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../theme';
import {isBackendConfigured} from '../core/config';
import {isNetworkError} from '../core/rooms/roomService';
import {useAppNavigation} from '../core/navigation';
import {dateKeyFor, pastDateKeys} from '../games/scout/dailySeed';
import {optInToSocial} from '../core/social/onboarding';
import {flushOutbox} from '../core/social/outbox';
import {presenceFor} from '../core/social/presence';
import {refreshFriendRequests, useRequestsStore} from '../core/social/requestsStore';
import {
  avatarUrlFor,
  fetchFriendsFeed,
  fetchMyProfile,
  getCachedProfile,
  isNameTakenError,
  removeFriend,
} from '../core/social/socialService';
import type {FriendFeed, SocialProfile} from '../core/social/types';
import {PersonCard, friendCellsFor, friendStreak} from './social/PersonCard';
import {RequestsSection} from './social/RequestsSection';
import {WorldwideBoard} from './social/WorldwideBoard';
import {useSendFriendRequest} from './social/useSendFriendRequest';
import {useSearch} from '../games/shared/SearchScreen';
import {ADD_FRIEND_PREFIX, friendSource} from '../games/shared/searchSources';

/** The feed window: today plus the six days before it. */
const WEEK_DAYS = 7;

type Props = {
  /** The tab shell's focus signal — all tab pages stay mounted. */
  isActive: boolean;
  /** A friend code from the miflo.dk/add/CODE deep link — auto-send once. */
  addCode?: string;
};

export function SocialScreen({isActive, addCode}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const todayKey = useMemo(() => dateKeyFor(new Date()), []);
  // Oldest → newest, ending on today.
  const weekKeys = useMemo(
    () => [...pastDateKeys(todayKey, WEEK_DAYS - 1).reverse(), todayKey],
    [todayKey],
  );

  const [profile, setProfile] = useState<SocialProfile | null | 'loading'>('loading');
  const [view, setView] = useState<'friends' | 'worldwide'>('friends');
  const [feed, setFeed] = useState<FriendFeed[] | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const requests = useRequestsStore(s => s.requests);
  const openSearch = useSearch();

  // Resolve the profile once: cache first (instant, works offline), then the
  // server as the truth when reachable. A stale "no cache" worst case just
  // shows onboarding again — ensure_profile is idempotent and never renames.
  useEffect(() => {
    let live = true;
    (async () => {
      const cached = await getCachedProfile();
      if (live && cached) {
        setProfile(cached);
      }
      if (!isBackendConfigured) {
        if (live && !cached) {
          setProfile(null);
        }
        return;
      }
      try {
        const remote = await fetchMyProfile();
        if (live) {
          setProfile(remote);
        }
      } catch {
        if (live && !cached) {
          setProfile(null);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const refreshFeed = useCallback(async () => {
    if (!isBackendConfigured) {
      return;
    }
    try {
      setFeed(await fetchFriendsFeed(weekKeys[0]));
    } catch (err) {
      toast.error(isNetworkError(err) ? t('common.errorNetwork') : t('social.loadError'));
      // Keep whatever is on screen; an empty list only replaces the skeleton.
      setFeed(prev => prev ?? []);
    }
  }, [weekKeys, t]);

  // Focus signal: retry queued publishes, refresh the friends feed + pending
  // requests. Runs on first activation too. `isActive` covers tab switches;
  // `isFocused` covers popping back from a pushed screen (a friend removed on
  // their profile page must leave the feed right away).
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isActive || !isFocused) {
      return;
    }
    flushOutbox().catch(() => {});
    if (profile && profile !== 'loading') {
      refreshFeed();
      refreshFriendRequests();
    }
  }, [isActive, isFocused, profile, refreshFeed]);

  // Deleting the profile (from the Menu) clears the cache; when this tab is
  // looked at again, drop to onboarding. A no-op while a profile is cached.
  useEffect(() => {
    if (!isActive || !isFocused) {
      return;
    }
    let live = true;
    getCachedProfile().then(cached => {
      if (live && !cached) {
        setProfile(null);
        setFeed(null);
      }
    });
    return () => {
      live = false;
    };
  }, [isActive, isFocused]);

  async function handleCreate() {
    const name = nameInput.trim();
    if (name.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      setProfile(await optInToSocial(name, todayKey));
    } catch (err) {
      toast.error(
        isNameTakenError(err)
          ? t('social.nameTaken')
          : isNetworkError(err)
            ? t('common.errorNetwork')
            : t('social.errorCreate'),
      );
    } finally {
      setBusy(false);
    }
  }

  const {send, busy: sending} = useSendFriendRequest({
    onFriendAdded: refreshFeed,
  });

  // A shared friend-code link (miflo.dk/add/CODE) lands here with `addCode`:
  // send the request as soon as a profile exists to send it from. Each code
  // value fires once; without a profile it waits for onboarding to finish.
  const consumedAddCode = useRef<string | null>(null);
  useEffect(() => {
    if (
      !addCode ||
      consumedAddCode.current === addCode ||
      profile === 'loading' ||
      profile === null
    ) {
      return;
    }
    consumedAddCode.current = addCode;
    send(addCode.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addCode, profile]);

  // The search button opens the shared FotMob grid over the friend list. A
  // pick opens that friend's profile; a query spelling an unknown code appends
  // an "add" tile that sends the request (adding IS searching for them).
  function openFriendSearch() {
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
  }

  /** Swipe action: confirm, then remove optimistically (server is truth). */
  function confirmRemove(friend: SocialProfile) {
    Alert.alert(
      t('social.removeTitle'),
      t('social.removeBody', {name: friend.displayName}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            const before = feed;
            setFeed(prev =>
              prev ? prev.filter(f => f.profile.userId !== friend.userId) : prev,
            );
            removeFriend(friend.userId).catch(() => {
              setFeed(before);
              toast.error(t('common.errorNetwork'));
            });
          },
        },
      ],
    );
  }

  const friendCards = (items: FriendFeed[]) =>
    items.map(friend => (
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
            navigation.navigate('FriendProfile', {
              profile: friend.profile,
            })
          }
        />
      </SwipeReveal>
    ));

  return (
    // Top/bottom safe-area edges are owned by the scroll content and shell nav.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={closeOpenSwipeReveal}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, slides off the top. One search
            button opens the shared grid, which both finds friends and adds one
            by code. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('social.title')}
          </Text>
          {profile !== 'loading' && profile !== null && view === 'friends' ? (
            <View style={styles.headerRight}>
              <CircleButton
                size={30}
                accessibilityLabel={t('social.searchA11y')}
                onPress={openFriendSearch}>
                <Search size={16} color={colors.ink} strokeWidth={2} />
              </CircleButton>
            </View>
          ) : null}
        </View>

        {!isBackendConfigured ? (
          <GlassCard style={styles.messageCard}>
            <Text variant="secondary" color="secondary" align="center">
              {t('social.unavailable')}
            </Text>
          </GlassCard>
        ) : profile === 'loading' ? (
          <View style={styles.skeletons}>
            <Skeleton height={120} />
            <Skeleton height={160} />
          </View>
        ) : profile === null ? (
          /* Onboarding — pick the social name (separate from party names). */
          <GlassCard style={styles.onboardCard}>
            <Text variant="section">{t('social.onboardTitle')}</Text>
            <Text variant="secondary" color="secondary">
              {t('social.onboardBody')}
            </Text>
            <TextField
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('social.namePlaceholder')}
              maxLength={15}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
              accessibilityLabel={t('social.namePlaceholder')}
            />
            <Button
              label={t('social.create')}
              onPress={handleCreate}
              disabled={busy || nameInput.trim().length === 0}
            />
          </GlassCard>
        ) : (
          <>
            {/* Friends | Worldwide — the two daily comparisons this tab holds.
                Switching to Worldwide closes the friend search. */}
            <View style={styles.viewToggle}>
              {(['friends', 'worldwide'] as const).map(v => (
                <GlassTag
                  key={v}
                  onPress={() => setView(v)}
                  accent={view === v}
                  accessibilityRole="button"
                  accessibilityLabel={t(`leaderboard.${v}`)}
                  style={styles.viewToggleTag}>
                  <Text
                    variant="secondary"
                    color={view === v ? 'primary' : 'secondary'}
                    style={view === v ? styles.viewToggleActive : undefined}>
                    {t(`leaderboard.${v}`)}
                  </Text>
                </GlassTag>
              ))}
            </View>

            {view === 'worldwide' ? (
              <WorldwideBoard
                todayKey={todayKey}
                active={isActive && isFocused}
                myName={profile.displayName}
                myAvatarUri={avatarUrlFor(profile.avatarPath)}
              />
            ) : (
          <>
            {/* People asking to be friends — only exists while pending. */}
            <RequestsSection
              requests={requests?.incoming ?? []}
              onAccepted={refreshFeed}
            />

            {feed === null ? (
              <Skeleton height={140} />
            ) : (
              /* Friends, alphabetically. Search lives in the grid overlay. */
              <View style={styles.section}>
                <Text variant="caption" color="tertiary" style={styles.eyebrow}>
                  {t('social.friendsDailyEyebrow').toUpperCase()}
                </Text>
                {feed.length === 0 ? (
                  <GlassCard style={styles.messageCard}>
                    <Text variant="secondary" color="secondary" align="center">
                      {t('social.empty')}
                    </Text>
                  </GlassCard>
                ) : (
                  friendCards(feed)
                )}
                {/* Requests we sent that still await an answer — quiet captions,
                    not cards; the other side owns the next move. */}
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
          </>
            )}
          </>
        )}
      </ScrollView>

      {/* Seamless frosted fade behind the status bar. */}
      <TopStatusFade />
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  // No paddingHorizontal here — Screen's default padded inset already applies
  // (doubling it made this tab visibly narrower than Home/Games).
  list: {
    gap: spacing.lg,
  },
  skeletons: {gap: spacing.lg},
  viewToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  viewToggleTag: {
    minWidth: 108,
    justifyContent: 'center',
  },
  viewToggleActive: {color: c.primaryInk},
  messageCard: {
    padding: spacing.xl,
  },
  onboardCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  section: {gap: spacing.sm},
  eyebrow: {
    letterSpacing: 1,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  });
