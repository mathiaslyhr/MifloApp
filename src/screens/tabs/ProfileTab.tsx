/**
 * Profile — the career page. Who you are, what your € has done, and everyone
 * you play with.
 *
 * The identity block stays pinned above a three-way segment, Instagram-style:
 * the header is the constant, the body swaps.
 *
 *   Career  — the € curve, the record, and the ranked matches behind it.
 *   Dailies — streaks and the full archive (which had no home at all after the
 *             sitemap reset; the Daily tab only ever shows today).
 *   Friends — requests, the list, remove, and add-by-code.
 *
 * Friends live here because the Friends tab is gone. Rather than bury them
 * behind a "See all" row, they get equal billing with the career, and a pending
 * request badges the Profile tab from the shell — so nothing is lost by their
 * not having a tab of their own.
 *
 * Answers are the owner's privilege: they ride only on days that are closed
 * (see `closed` below), so a live puzzle can never spoil itself.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {ScrollView} from 'react-native-gesture-handler';
import {useIsFocused} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {Menu, Search} from 'lucide-react-native';
import {
  Button,
  Card,
  CircleButton,
  NameSheet,
  Segmented,
  Skeleton,
  Text,
  TextField,
  toast,
  type SegmentedOption,
} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {isBackendConfigured} from '../../core/config';
import {isNetworkError} from '../../core/rooms/roomService';
import {useAppNavigation} from '../../core/navigation';
import {dateKeyFor, pastDateKeys} from '../../games/scout/dailySeed';
import {optInToSocial} from '../../core/social/onboarding';
import {flushOutbox} from '../../core/social/outbox';
import {refreshFriendRequests} from '../../core/social/requestsStore';
import {
  avatarUrlFor,
  fetchFriendsFeed,
  fetchMyProfile,
  getCachedProfile,
  isNameTakenError,
  setDisplayName,
  setFavorites,
} from '../../core/social/socialService';
import type {FriendFeed, SocialProfile} from '../../core/social/types';
import {
  fetchMatchHistory,
  fetchMyValue,
  peekCachedHistory,
  peekCachedValue,
  readCachedHistory,
  readCachedValue,
  writeCachedHistory,
  writeCachedValue,
} from '../../core/rooms/rankedService';
import type {MyHistory} from '../../games/ranked-hattrick/history';
import {DAILY_GAMES, loadDailyLog, type DailyLog} from '../../core/daily/dailyLog';
import {dailyAnswerFor} from '../../core/daily/answers';
import {ProfileHeader} from '../profile/ProfileHeader';
import {FavoritesShowcase, type Favorites} from '../profile/FavoritesShowcase';
import {StreaksSection} from '../profile/StreaksSection';
import {HistorySection, type HistoryDay} from '../profile/HistorySection';
import {CareerSection} from '../profile/CareerSection';
import {FriendsSection} from '../profile/FriendsSection';
import {CodeBlock} from '../social/CodeBlock';
import {TabPage} from './TabPage';

/** The friends feed window: today plus the six days before it. */
const WEEK_DAYS = 7;

export type ProfileSegment = 'career' | 'dailies' | 'friends';

type Props = {
  /** The tab shell's focus signal — all four tab pages stay mounted. */
  isActive?: boolean;
  /** A friend code from the miflo.dk/add/CODE deep link. */
  addCode?: string;
  /** Deep links and pushes that mean "friends" open on that segment. */
  initialSegment?: ProfileSegment;
};

export function ProfileTab({isActive = true, addCode, initialSegment}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const navigation = useAppNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const isFocused = useIsFocused();

  const todayKey = useMemo(() => dateKeyFor(new Date()), []);
  const weekKeys = useMemo(
    () => [...pastDateKeys(todayKey, WEEK_DAYS - 1).reverse(), todayKey],
    [todayKey],
  );

  const [segment, setSegment] = useState<ProfileSegment>(initialSegment ?? 'career');
  const [profile, setProfile] = useState<SocialProfile | null | 'loading'>('loading');
  const [feed, setFeed] = useState<FriendFeed[] | null>(null);
  const [log, setLog] = useState<DailyLog | null>(null);
  // Seeded from memory so a reopen paints the real curve on frame one.
  const [history, setHistory] = useState<MyHistory | null>(peekCachedHistory);
  const [value, setValue] = useState<number | null>(() => peekCachedValue()?.value ?? null);
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const openFriendSearch = useRef<(() => void) | null>(null);

  // A deep link asking for friends flips the segment.
  useEffect(() => {
    if (initialSegment) {
      setSegment(initialSegment);
    }
  }, [initialSegment]);

  // Resolve the profile once: cache first (instant, works offline), then the
  // server as truth when reachable. A stale "no cache" worst case just shows
  // onboarding again — ensure_profile is idempotent and never renames.
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

  const hasProfile = profile !== null && profile !== 'loading';

  // The focus signal. `isActive` covers tab switches: all four pages stay
  // mounted, so useFocusEffect alone fires for the whole Tabs route and can't
  // tell them apart. `isFocused` covers popping back from a pushed screen — a
  // friend removed on their own profile page must leave this list at once.
  useEffect(() => {
    if (!isActive || !isFocused || !hasProfile) {
      return;
    }
    let live = true;
    flushOutbox().catch(() => {});
    refreshFeed();
    refreshFriendRequests();
    loadDailyLog(todayKey).then(l => live && setLog(l));

    (async () => {
      // Paint the disk's copy first, then let the network correct it — the €
      // barely moves between visits, so last-known is the honest thing to show
      // while Supabase answers.
      const [cachedValue, cachedHistory] = await Promise.all([
        readCachedValue(),
        readCachedHistory(),
      ]);
      if (!live) {
        return;
      }
      setValue(prev => prev ?? cachedValue?.value ?? null);
      setHistory(prev => prev ?? cachedHistory);
      try {
        const [v, h] = await Promise.all([fetchMyValue(), fetchMatchHistory()]);
        if (!live) {
          return;
        }
        setValue(v.value);
        setHistory(h);
        await Promise.all([writeCachedValue(v), writeCachedHistory(h)]);
      } catch {
        // Offline: the cached career stands rather than dropping to a shell.
      }
    })();

    return () => {
      live = false;
    };
  }, [isActive, isFocused, hasProfile, refreshFeed, todayKey]);

  // Deleting the profile (from the Menu) clears the cache; drop to onboarding
  // the next time this tab is looked at. A no-op while a profile is cached.
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

  /** Optimistic, reverting on failure — the server stays the truth. */
  async function handleRename(next: string) {
    setRenaming(false);
    if (!hasProfile) {
      return;
    }
    const before = profile as SocialProfile;
    setProfile({...before, displayName: next});
    try {
      await setDisplayName(next);
    } catch (err) {
      setProfile(before);
      toast.error(
        isNameTakenError(err)
          ? t('social.nameTaken')
          : isNetworkError(err)
            ? t('common.errorNetwork')
            : t('social.errorCreate'),
      );
    }
  }

  async function handleFavorites(next: Favorites) {
    if (!hasProfile) {
      return;
    }
    const before = profile as SocialProfile;
    setProfile({
      ...before,
      favoritePlayerId: next.playerId,
      favoriteClubId: next.clubId,
      favoriteNation: next.nation,
    });
    try {
      await setFavorites(next);
    } catch {
      setProfile(before);
      toast.error(t('common.errorNetwork'));
    }
  }

  // The archive. Answers ride only on days that are CLOSED — won, revealed, or
  // simply not today. A live puzzle must never carry its own answer here.
  const historyDays: HistoryDay[] = useMemo(() => {
    if (!log) {
      return [];
    }
    return log.days.map(day => ({
      dateKey: day.dateKey,
      rows: DAILY_GAMES.map(game => {
        const cell = day.cells[game];
        const closed =
          cell.status === 'won' || cell.status === 'revealed' || day.dateKey !== todayKey;
        return {
          game,
          status: cell.status,
          right: cell.right,
          wrong: cell.wrong,
          answer: closed ? dailyAnswerFor(game, day.dateKey, cell.refId, t) : null,
        };
      }),
    }));
  }, [log, todayKey, t]);

  const segments: SegmentedOption<ProfileSegment>[] = [
    {key: 'career', label: t('profile.segmentCareer')},
    {key: 'dailies', label: t('profile.segmentDailies')},
    {key: 'friends', label: t('profile.segmentFriends')},
  ];

  // One corner, two jobs: the friend search only exists while friends are the
  // body it would search.
  const corner = (
    <View style={styles.corner}>
      {hasProfile && segment === 'friends' ? (
        <CircleButton
          size={30}
          accessibilityLabel={t('social.searchA11y')}
          onPress={() => openFriendSearch.current?.()}>
          <Search size={16} color={colors.ink} strokeWidth={2} />
        </CircleButton>
      ) : null}
      <CircleButton
        size={30}
        accessibilityLabel={t('menu.title')}
        onPress={() => navigation.navigate('Menu')}>
        <Menu size={16} color={colors.ink} strokeWidth={2} />
      </CircleButton>
    </View>
  );

  return (
    <TabPage title={t('tabs.profile')} right={corner} scrollRef={scrollRef}>
      {profile === 'loading' ? (
        <View style={styles.body}>
          <Skeleton height={96} />
          <Skeleton height={232} />
        </View>
      ) : profile === null ? (
        /* Not opted in — pick the social name (separate from party names). */
        <Card style={styles.onboardCard}>
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
        </Card>
      ) : (
        <View style={styles.body}>
          <ProfileHeader
            name={profile.displayName}
            tone="accent"
            // The feed IS the friend list, so its length is the count — no
            // second call, and the two can never disagree. Null while it loads,
            // which is exactly when the header wants to hide the line.
            friendCount={feed?.length ?? null}
            onPressFriends={() => setSegment('friends')}
            onEditName={() => setRenaming(true)}
            avatarUri={avatarUrlFor(profile.avatarPath)}
          />

          {/* Above the segments, with the avatar and the name: favourites are
              identity, so they belong to the header rather than to any one
              segment of the body. */}
          <FavoritesShowcase
            favorites={{
              playerId: profile.favoritePlayerId,
              clubId: profile.favoriteClubId,
              nation: profile.favoriteNation,
            }}
            editable
            onChange={handleFavorites}
          />

          <Segmented options={segments} value={segment} onChange={setSegment} />

          {segment === 'career' ? (
            <CareerSection
              history={history}
              value={value}
              todayKey={todayKey}
              onFindMatch={() => navigation.navigate('RankedSearch')}
            />
          ) : segment === 'dailies' ? (
            <View style={styles.body}>
              {log === null ? (
                <Skeleton height={200} />
              ) : (
                <>
                  <StreaksSection
                    cells={DAILY_GAMES.map(game => ({
                      game,
                      current: log.streaks[game].current,
                      best: log.streaks[game].best,
                    }))}
                  />
                  <HistorySection days={historyDays} todayKey={todayKey} />
                </>
              )}
            </View>
          ) : (
            <View style={styles.body}>
              <FriendsSection
                feed={feed}
                setFeed={setFeed}
                refreshFeed={refreshFeed}
                todayKey={todayKey}
                scrollRef={scrollRef}
                addCode={addCode}
                onSearchReady={open => {
                  openFriendSearch.current = open;
                }}
              />
              {/* Your code sits with the friends, because handing it to one is
                  the only thing it's for. */}
              <Card style={styles.codeCard}>
                <CodeBlock code={profile.friendCode} divider={false} />
              </Card>
            </View>
          )}
        </View>
      )}

      <NameSheet
        visible={renaming}
        title={t('profile.editNameTitle')}
        initialValue={hasProfile ? (profile as SocialProfile).displayName : ''}
        placeholder={t('social.namePlaceholder')}
        confirmLabel={t('common.save')}
        maxLength={15}
        onConfirm={handleRename}
        onCancel={() => setRenaming(false)}
      />
    </TabPage>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.lg},
    corner: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    onboardCard: {padding: spacing.xl, gap: spacing.md},
    codeCard: {paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
  });
