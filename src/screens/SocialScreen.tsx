/**
 * Friends — the social tab. Shows how your friends did in today's daily games
 * (score level only, never answers) plus a 7-day completion strip, so nobody
 * has to text screenshots around anymore.
 *
 * No accounts: identity is the app's anonymous session. Opting in creates a
 * profile with a chosen display name (deliberately separate from the random
 * per-room party names) and a permanent shareable friend code; typing a
 * friend's code makes the friendship instantly mutual.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, Share, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {Flame} from 'lucide-react-native';
import {
  Avatar,
  Button,
  GlassCard,
  NAV_HEIGHT,
  Screen,
  Skeleton,
  Text,
  TextField,
  toast,
  TopStatusFade,
} from '../core/ui';
import {colors, fonts, screenPadding, spacing} from '../theme';
import {isBackendConfigured} from '../core/config';
import {isNetworkError} from '../core/rooms/roomService';
import {dateKeyFor, pastDateKeys} from '../games/scout/dailySeed';
import {
  DAILY_GAMES,
  loadDailyLog,
  type DailyGame,
  type DailyLogDay,
  type DayCellStatus,
} from '../core/daily/dailyLog';
import {DailyChip} from '../core/daily/DailyChip';
import {dailyAnswerFor} from '../core/daily/answers';
import {flushOutbox, runBackfill} from '../core/social/outbox';
import {collectMyResults, type MyRecentResults} from '../core/social/myResults';
import {MAX_ACTIVE_AGE_MIN, presenceFor, type Presence} from '../core/social/presence';
import {
  addFriend,
  createProfile,
  fetchFriendsFeed,
  fetchMyProfile,
  getCachedProfile,
  isOwnCodeError,
  isUnknownCodeError,
  removeFriend,
} from '../core/social/socialService';
import type {FriendFeed, PublishedResult, SocialProfile} from '../core/social/types';

/** What one chip on a person card shows — a friend's published state, or my
 * local state (only mine may carry an answer; published rows never do). */
type ChipCell = {status: DayCellStatus; count: number | null; answer: string | null};

/** The feed window: today plus the six days before it. */
const WEEK_DAYS = 7;

type Props = {
  /** The tab shell's focus signal — all tab pages stay mounted. */
  isActive: boolean;
};

export function SocialScreen({isActive}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const todayKey = useMemo(() => dateKeyFor(new Date()), []);
  // Oldest → newest, ending on today (the strip reads left to right).
  const weekKeys = useMemo(
    () => [...pastDateKeys(todayKey, WEEK_DAYS - 1).reverse(), todayKey],
    [todayKey],
  );

  const [profile, setProfile] = useState<SocialProfile | null | 'loading'>('loading');
  const [feed, setFeed] = useState<FriendFeed[] | null>(null);
  const [mine, setMine] = useState<MyRecentResults | null>(null);
  // My local today row (includes ongoing state + answer ids) — richer than
  // the published copy, and never leaves the device.
  const [myDay, setMyDay] = useState<DailyLogDay | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);

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

  // Focus signal: retry queued publishes, reload my local results, refresh the
  // friends feed. Runs on first activation too.
  useEffect(() => {
    if (!isActive) {
      return;
    }
    flushOutbox().catch(() => {});
    let live = true;
    // My own card reads the games' local histories through the same
    // normalizers that publish to friends, so both sides always agree.
    collectMyResults(weekKeys[0], todayKey).then(loaded => {
      if (live) {
        setMine(loaded);
      }
    });
    // Today's local cells for my chips: ongoing games and answers only exist
    // here — the published rows friends receive never carry answers.
    loadDailyLog(todayKey).then(log => {
      if (live) {
        setMyDay(log.days[0] ?? null);
      }
    });
    if (profile && profile !== 'loading') {
      refreshFeed();
    }
    return () => {
      live = false;
    };
  }, [isActive, profile, refreshFeed, todayKey, weekKeys]);

  async function handleCreate() {
    const name = nameInput.trim();
    if (name.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      const created = await createProfile(name);
      setProfile(created);
      // First publish: seed the last 14 days from local history, so friends
      // see more than an empty card on day one.
      runBackfill(todayKey).catch(() => {});
    } catch (err) {
      toast.error(isNetworkError(err) ? t('common.errorNetwork') : t('social.errorCreate'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddFriend() {
    const code = codeInput.trim();
    if (code.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      const friend = await addFriend(code);
      setCodeInput('');
      toast.success(t('social.friendAdded', {name: friend.displayName}));
      refreshFeed();
    } catch (err) {
      if (isUnknownCodeError(err)) {
        toast.error(t('social.errorNotFound'));
      } else if (isOwnCodeError(err)) {
        toast.error(t('social.errorSelf'));
      } else {
        toast.error(isNetworkError(err) ? t('common.errorNetwork') : t('social.errorAdd'));
      }
    } finally {
      setBusy(false);
    }
  }

  // My four chips, from the local log: same states a friend would see, plus
  // the answers behind my finished days (owner's privilege, local only).
  const myCells = useMemo(() => {
    const map = new Map<DailyGame, ChipCell>();
    if (!myDay) {
      return map;
    }
    for (const game of DAILY_GAMES) {
      const cell = myDay.cells[game];
      const finished = cell.status === 'won' || cell.status === 'revealed';
      map.set(game, {
        status: cell.status,
        count: cell.count,
        answer: finished ? dailyAnswerFor(game, myDay.dateKey, cell.refId, t) : null,
      });
    }
    return map;
  }, [myDay, t]);

  function handleShare(code: string) {
    Share.share({message: t('social.shareMessage', {code})}).catch(() => {});
  }

  function confirmRemove(friend: SocialProfile) {
    Alert.alert(t('social.removeTitle'), t('social.removeBody', {name: friend.displayName}), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => {
          removeFriend(friend.userId)
            .then(refreshFeed)
            .catch(() => toast.error(t('common.errorNetwork')));
        },
      },
    ]);
  }

  return (
    // Top/bottom safe-area edges are owned by the scroll content and shell nav.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, slides off the top. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('social.title')}
          </Text>
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
              maxLength={20}
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
            {/* Your code + add a friend — the tab's utility block. */}
            <GlassCard style={styles.codeCard}>
              <View style={styles.codeRow}>
                <View style={styles.codeCol}>
                  <Text variant="caption" color="tertiary" style={styles.eyebrow}>
                    {t('social.yourCode').toUpperCase()}
                  </Text>
                  <Text style={styles.code} accessibilityLabel={profile.friendCode}>
                    {profile.friendCode}
                  </Text>
                </View>
                <Button
                  label={t('social.share')}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => handleShare(profile.friendCode)}
                />
              </View>
              <View style={styles.divider} />
              <Text variant="caption" color="tertiary" style={styles.eyebrow}>
                {t('social.addTitle').toUpperCase()}
              </Text>
              <View style={styles.addRow}>
                <View style={styles.addField}>
                  <TextField
                    value={codeInput}
                    onChangeText={setCodeInput}
                    placeholder={t('social.addPlaceholder')}
                    maxLength={6}
                    autoCapitalize="characters"
                    returnKeyType="go"
                    onSubmitEditing={handleAddFriend}
                    accessibilityLabel={t('social.addPlaceholder')}
                  />
                </View>
                <Button
                  label={t('social.add')}
                  onPress={handleAddFriend}
                  fullWidth={false}
                  disabled={busy || codeInput.trim().length === 0}
                />
              </View>
            </GlassCard>

            {/* You first — the local truth, no network needed. */}
            <View style={styles.section}>
              <PersonCard
                name={t('social.you')}
                accent
                streak={mine?.bestStreak ?? 0}
                today={myCells}
                weekCounts={weekKeys.map(
                  key => mine?.results.filter(r => r.dateKey === key).length ?? 0,
                )}
                weekKeys={weekKeys}
              />
            </View>

            {/* Friends, alphabetically. */}
            <View style={styles.section}>
              <Text variant="caption" color="tertiary" style={styles.eyebrow}>
                {t('social.friends').toUpperCase()}
              </Text>
              {feed === null ? (
                <Skeleton height={140} />
              ) : feed.length === 0 ? (
                <GlassCard style={styles.messageCard}>
                  <Text variant="secondary" color="secondary" align="center">
                    {t('social.empty')}
                  </Text>
                </GlassCard>
              ) : (
                feed.map(friend => (
                  <PersonCard
                    key={friend.profile.userId}
                    name={friend.profile.displayName}
                    presence={presenceFor(friend.profile.lastSeenAt, Date.now())}
                    streak={friendStreak(friend.results, todayKey)}
                    today={friendCellsFor(friend.results, todayKey)}
                    weekCounts={weekKeys.map(
                      // Finished games only — an ongoing game isn't a result
                      // yet, and my own dots count the same way.
                      key =>
                        friend.results.filter(
                          r => r.dateKey === key && r.status !== 'ongoing',
                        ).length,
                    )}
                    weekKeys={weekKeys}
                    onLongPress={() => confirmRemove(friend.profile)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Seamless frosted fade behind the status bar. */}
      <TopStatusFade />
    </Screen>
  );
}

/** A friend's today chips from their published rows — status + tries only,
 * never an answer (the wire cannot carry one). */
function friendCellsFor(results: PublishedResult[], todayKey: string): Map<DailyGame, ChipCell> {
  const map = new Map<DailyGame, ChipCell>();
  for (const r of results) {
    if (r.dateKey === todayKey) {
      map.set(r.game, {status: r.status, count: r.score, answer: null});
    }
  }
  return map;
}

/** "Active 14 min ago" caption; nothing when online (the dot), after 7 days, or unknown. */
function formatLastActive(presence: Presence, t: TFunction): string | null {
  const m = presence.minutesAgo;
  if (presence.online || m === null || m > MAX_ACTIVE_AGE_MIN) {
    return null;
  }
  if (m < 60) {
    return t('social.activeMinutes', {count: m});
  }
  if (m < 24 * 60) {
    return t('social.activeHours', {count: Math.floor(m / 60)});
  }
  return t('social.activeDays', {count: Math.floor(m / (24 * 60))});
}

/** A friend's best live streak — only today's rows are trusted for streaks. */
function friendStreak(results: PublishedResult[], todayKey: string): number {
  let best = 0;
  for (const r of results) {
    if (r.dateKey === todayKey && r.streak > best) {
      best = r.streak;
    }
  }
  return best;
}

type PersonCardProps = {
  name: string;
  streak: number;
  today: Map<DailyGame, ChipCell>;
  weekCounts: number[];
  weekKeys: string[];
  accent?: boolean;
  /** Friend cards only — the You card shows no presence. */
  presence?: Presence;
  onLongPress?: () => void;
};

/** One person's day: name row, four today-chips, and the 7-day strip. */
function PersonCard({name, streak, today, weekCounts, weekKeys, accent, presence, onLongPress}: PersonCardProps) {
  const {t} = useTranslation();
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  const activeLabel = presence ? formatLastActive(presence, t) : null;
  const card = (
    <GlassCard style={styles.personCard}>
      <View style={styles.personRow}>
        <View>
          <Avatar initials={initials} tone={accent ? 'accent' : 'soft'} />
          {presence?.online ? (
            <View style={styles.onlineDot} accessibilityLabel={t('social.a11yOnline')} />
          ) : null}
        </View>
        <View style={styles.personName}>
          <Text variant="label" numberOfLines={1}>
            {name}
          </Text>
          {activeLabel ? (
            <Text variant="caption" color="tertiary" numberOfLines={1}>
              {activeLabel}
            </Text>
          ) : null}
        </View>
        {streak > 1 ? (
          <View style={styles.streak} accessibilityLabel={t('social.a11yStreak', {count: streak})}>
            <Flame size={14} color={colors.primary} strokeWidth={2} />
            <Text variant="caption" color="secondary">
              {streak}
            </Text>
          </View>
        ) : null}
      </View>
      {/* Two chips per row with full game names — mirrors the Log tab. */}
      <View style={styles.chipGrid}>
        {DAILY_GAMES.map(game => {
          const cell = today.get(game);
          return (
            <DailyChip
              key={game}
              game={game}
              status={cell?.status ?? 'notPlayed'}
              count={cell?.count ?? null}
              answer={cell?.answer ?? null}
            />
          );
        })}
      </View>
      <View style={styles.weekRow}>
        {weekKeys.map((key, i) => (
          <View
            key={key}
            style={[styles.weekDot, weekCounts[i] === 0 && styles.weekDotEmpty]}
            accessibilityLabel={t('social.a11yWeekDay', {
              date: key,
              count: weekCounts[i],
              total: DAILY_GAMES.length,
            })}>
            {weekCounts[i] > 0 ? (
              <Text variant="caption" color="secondary">
                {weekCounts[i]}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </GlassCard>
  );
  if (!onLongPress) {
    return card;
  }
  // Long-press is the quiet "remove friend" affordance (confirmed via Alert).
  return <Pressable onLongPress={onLongPress}>{card}</Pressable>;
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  list: {
    paddingHorizontal: screenPadding,
    gap: spacing.lg,
  },
  skeletons: {gap: spacing.lg},
  messageCard: {
    padding: spacing.xl,
  },
  onboardCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  codeCard: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  codeCol: {gap: 2},
  // The code is a deliberate "moment": wordmark weight at the scale's 20 cap,
  // spaced out so the six characters read one by one.
  code: {
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 4,
    color: colors.ink,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassRim,
    marginVertical: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addField: {flex: 1},
  section: {gap: spacing.sm},
  eyebrow: {
    letterSpacing: 1,
  },
  personCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personName: {flex: 1},
  // Instagram-style presence: a small green disc pinned to the avatar's
  // corner, rimmed in surface white so it reads on the glass card.
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  weekDotEmpty: {
    opacity: 0.35,
    backgroundColor: 'transparent',
  },
});
