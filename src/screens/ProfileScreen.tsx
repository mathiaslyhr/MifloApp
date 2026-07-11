/**
 * Profile — the tab page that replaced Log and Menu. Instagram-shaped: your
 * identity up top (big avatar, name, friends count), your streaks, then the
 * full daily-games log underneath (the old Log tab's content, answers and
 * all — the owner's privilege). The rest of the old Menu lives behind the
 * hamburger corner button, pushed as a detail screen.
 *
 * Lives in the tab shell like Home/Games/Friends: the header scrolls away,
 * the shared nav island floats over the bottom. The page stays mounted across
 * tab switches, so `isActive` is its focus signal; `useIsFocused` covers the
 * other gap — popping back from a pushed screen (a removal on a friend's
 * profile must update the count right away).
 */
import React, {useEffect, useState} from 'react';
import {ActionSheetIOS, ScrollView, StyleSheet, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {Menu} from 'lucide-react-native';
import {
  Avatar,
  Button,
  CircleButton,
  GlassCard,
  NameSheet,
  NAV_HEIGHT,
  Screen,
  Text,
  toast,
  TopStatusFade,
} from '../core/ui';
import {colors, spacing} from '../theme';
import {isBackendConfigured} from '../core/config';
import {isNetworkError} from '../core/rooms/roomService';
import {useAppNavigation} from '../core/navigation';
import {dateKeyFor} from '../games/scout/dailySeed';
import {dailyAnswerFor} from '../core/daily/answers';
import {
  DAILY_GAMES,
  loadDailyLog,
  type DailyLog,
} from '../core/daily/dailyLog';
import {optInToSocial} from '../core/social/onboarding';
import {launchImageLibrary} from 'react-native-image-picker';
import {
  avatarUrlFor,
  clearAvatar,
  fetchFriends,
  fetchMyProfile,
  getCachedProfile,
  isNameTakenError,
  setAvatarPath,
  setDisplayName,
  uploadAvatar,
} from '../core/social/socialService';
import type {SocialProfile} from '../core/social/types';
import {CodeBlock} from './social/CodeBlock';
import {ProfileHeader} from './profile/ProfileHeader';
import {StreaksSection} from './profile/StreaksSection';
import {HistorySection, type HistoryDay} from './profile/HistorySection';

/** Last known own friend count — the header never flashes blank offline. */
const FRIEND_COUNT_KEY = 'social.friendCount';

type Props = {
  /** The tab shell's focus signal — all tab pages stay mounted. */
  isActive: boolean;
};

export function ProfileScreen({isActive}: Props) {
  const {t} = useTranslation();
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [profile, setProfile] = useState<SocialProfile | null | 'loading'>('loading');
  const [friendCount, setFriendCount] = useState<number | null>(null);
  // Log + the day it was loaded for, together, so a load finishing just after
  // midnight can't label the wrong row "Today".
  const [state, setState] = useState<{log: DailyLog; todayKey: string} | null>(
    null,
  );
  const [sheet, setSheet] = useState<'rename' | 'create' | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  // Bumped after a fresh upload so the new photo beats the CDN's cache of the
  // previous image at the same (stable) object key.
  const [avatarBust, setAvatarBust] = useState<number | undefined>(undefined);

  // Resolve the profile once: cache first (instant, works offline), then the
  // server as the truth when reachable — same recipe as the Friends tab.
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

  // Reload the archive every time the page is looked at (tab switch or a
  // pushed screen popping back), so finishing a game flips today's rows.
  useEffect(() => {
    if (!isActive || !isFocused) {
      return;
    }
    const todayKey = dateKeyFor(new Date());
    let live = true;
    loadDailyLog(todayKey).then(log => {
      if (live) {
        setState({log, todayKey});
      }
    });
    return () => {
      live = false;
    };
  }, [isActive, isFocused]);

  // The friends count: cached number first, then the live list as the truth.
  useEffect(() => {
    if (!isActive || !isFocused || !profile || profile === 'loading') {
      return;
    }
    let live = true;
    AsyncStorage.getItem(FRIEND_COUNT_KEY)
      .then(raw => {
        const cached = raw === null ? NaN : Number(raw);
        if (live && Number.isFinite(cached)) {
          setFriendCount(prev => prev ?? cached);
        }
      })
      .catch(() => {});
    fetchFriends()
      .then(friends => {
        if (live) {
          setFriendCount(friends.length);
        }
        AsyncStorage.setItem(FRIEND_COUNT_KEY, String(friends.length)).catch(
          () => {},
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isActive, isFocused, profile]);

  /** Optimistic rename; the server row is the truth, so failure reverts. */
  function rename(name: string) {
    if (!profile || profile === 'loading' || name === profile.displayName) {
      setSheet(null);
      return;
    }
    const before = profile;
    setProfile({...profile, displayName: name});
    setSheet(null);
    setDisplayName(name).catch(err => {
      setProfile(before);
      if (isNameTakenError(err)) {
        // Bounce back into the sheet so they can pick another name.
        toast.error(t('social.nameTaken'));
        setSheet('rename');
        return;
      }
      toast.error(
        isNetworkError(err) ? t('common.errorNetwork') : t('profile.errorRename'),
      );
    });
  }

  /** Tap the avatar: with a picture set, offer choose/remove; otherwise go
   * straight to the picker (nothing to remove yet). */
  function onAvatarPress() {
    if (!profile || profile === 'loading' || avatarBusy) {
      return;
    }
    if (!profile.avatarPath) {
      pickAvatar();
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t('profile.avatarChoose'),
          t('profile.avatarRemove'),
          t('common.cancel'),
        ],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      index => {
        if (index === 0) {
          pickAvatar();
        } else if (index === 1) {
          removeAvatar();
        }
      },
    );
  }

  /** Clear the avatar back to initials. Optimistic, mirroring pickAvatar. */
  async function removeAvatar() {
    if (!profile || profile === 'loading' || avatarBusy) {
      return;
    }
    const before = profile;
    setAvatarBusy(true);
    setProfile({...before, avatarPath: null});
    try {
      await clearAvatar();
      setAvatarBust(Date.now());
      toast.success(t('profile.avatarRemoved'));
    } catch (err) {
      setProfile(before);
      toast.error(
        isNetworkError(err) ? t('common.errorNetwork') : t('profile.errorAvatar'),
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  /** Pick a photo, upload it, and point the profile at it. Optimistic: the
   * server row is the truth, so any failure reverts and toasts. */
  async function pickAvatar() {
    if (!profile || profile === 'loading' || avatarBusy) {
      return;
    }
    const res = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.7,
      includeBase64: true,
      selectionLimit: 1,
    }).catch(() => null);
    if (!res || res.didCancel) {
      return;
    }
    const base64 = res.assets?.[0]?.base64;
    if (res.errorCode || !base64) {
      if (res.errorCode) {
        toast.error(t('profile.errorAvatar'));
      }
      return;
    }
    const before = profile;
    setAvatarBusy(true);
    try {
      const path = await uploadAvatar(base64);
      await setAvatarPath(path);
      setProfile({...before, avatarPath: path});
      setAvatarBust(Date.now());
      toast.success(t('profile.avatarUpdated'));
    } catch (err) {
      setProfile(before);
      toast.error(
        isNetworkError(err) ? t('common.errorNetwork') : t('profile.errorAvatar'),
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function create(name: string) {
    if (busy) {
      return;
    }
    setBusy(true);
    setSheet(null);
    try {
      setProfile(await optInToSocial(name, dateKeyFor(new Date())));
    } catch (err) {
      if (isNameTakenError(err)) {
        toast.error(t('social.nameTaken'));
        setSheet('create');
        return;
      }
      toast.error(
        isNetworkError(err) ? t('common.errorNetwork') : t('social.errorCreate'),
      );
    } finally {
      setBusy(false);
    }
  }

  // The own log with answers behind finished days — the owner's privilege;
  // the published copies friends see never carry answers.
  const historyDays: HistoryDay[] = state
    ? state.log.days.map(day => ({
        dateKey: day.dateKey,
        rows: DAILY_GAMES.map(game => {
          const cell = day.cells[game];
          // A day is closed once it's finished or the calendar moved past it —
          // then the answer may show. Today's open games stay secret.
          const closed =
            cell.status === 'won' ||
            cell.status === 'revealed' ||
            day.dateKey !== state.todayKey;
          return {
            game,
            status: cell.status,
            count: cell.count,
            answer: closed
              ? dailyAnswerFor(game, day.dateKey, cell.refId, t)
              : null,
          };
        }),
      }))
    : [];

  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away) and the shell nav owns the bottom inset.
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
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top.
            The hamburger opens the pushed Menu (Home's corner-button pattern). */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('profile.title')}
          </Text>
          <View style={styles.headerRight}>
            <CircleButton
              size={30}
              accessibilityLabel={t('profile.menuA11y')}
              onPress={() => navigation.navigate('Menu')}>
              <Menu size={16} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </View>

        {profile !== 'loading' && profile !== null ? (
          /* One identity block: header row, then the shareable code right
             under it, tighter than the page's list rhythm so they read as
             a unit. */
          <View style={styles.identity}>
            <ProfileHeader
              name={profile.displayName}
              tone="accent"
              friendCount={friendCount}
              // The one friends list lives on the Friends tab — jump there
              // (`at` keeps repeat taps distinct so the shell effect refires).
              onPressFriends={() =>
                navigation.navigate('Tabs', {tab: 'social', at: Date.now()})
              }
              onEditName={() => setSheet('rename')}
              avatarUri={avatarUrlFor(profile.avatarPath, avatarBust)}
              onPressAvatar={onAvatarPress}
            />
            <GlassCard style={styles.codeCard}>
              <CodeBlock code={profile.friendCode} divider={false} />
            </GlassCard>
          </View>
        ) : profile === null ? (
          /* Not opted into Friends yet — the identity block becomes the same
             invitation the Friends tab makes, sharing one create flow. */
          <View style={styles.setup}>
            <Avatar initials="?" tone="soft" size={84} />
            <Text variant="section" align="center">
              {t('social.onboardTitle')}
            </Text>
            <Text
              variant="secondary"
              color="secondary"
              align="center"
              style={styles.setupBody}>
              {t('social.onboardBody')}
            </Text>
            <Button
              label={t('social.create')}
              variant="primary"
              onPress={() => setSheet('create')}
              disabled={busy}
            />
          </View>
        ) : null}

        {state ? (
          <>
            <StreaksSection
              cells={DAILY_GAMES.map(game => ({
                game,
                current: state.log.streaks[game].current,
                best: state.log.streaks[game].best,
              }))}
            />
            <HistorySection days={historyDays} todayKey={state.todayKey} />
          </>
        ) : null}
      </ScrollView>

      <NameSheet
        visible={sheet !== null}
        title={sheet === 'create' ? t('social.onboardTitle') : t('profile.editNameTitle')}
        initialValue={
          sheet === 'rename' && profile !== 'loading' && profile !== null
            ? profile.displayName
            : ''
        }
        placeholder={t('social.namePlaceholder')}
        confirmLabel={sheet === 'create' ? t('social.create') : t('common.save')}
        onConfirm={name => (sheet === 'create' ? create(name) : rename(name))}
        onCancel={() => setSheet(null)}
      />

      {/* Seamless frosted fade behind the status bar — content dissolves under
          it (no hard edge) as it scrolls up. */}
      <TopStatusFade />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  identity: {gap: spacing.md},
  codeCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  setup: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  setupBody: {
    maxWidth: 300,
    marginBottom: spacing.xs,
  },
});
