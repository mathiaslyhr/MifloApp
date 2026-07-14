/**
 * The Home screen: the app's daily face for a returning player. Lives inside
 * the navigator so it can launch the dailies and the party Lobby.
 *
 * It's a "Today" dashboard, not a social feed:
 *   Header            wordmark + a streak flame (best current daily streak)
 *   Today             the four dailies as live status rows → tap to play
 *   Play with friends Create / Join party
 *   Friends today     a horizontal carousel of friends' unfolded day cards
 *
 * Reuses the daily-status language (DailyRow) and the shared create-party hook.
 */
import React, {useCallback, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {ChevronRight, Flame, UserPlus} from 'lucide-react-native';
import {AppMark, Button, NAV_HEIGHT, PressableScale, QrCard, Text} from '../../core/ui';
import {APP_STORE_URL} from '../../core/config';
import {avatarUrlFor, fetchFriendsFeed} from '../../core/social/socialService';
import {presenceFor} from '../../core/social/presence';
import type {FriendFeed} from '../../core/social/types';
import {DailyRow} from '../../core/daily/DailyRow';
import {loadDailyLog, DAILY_GAMES, type DailyGame} from '../../core/daily/dailyLog';
import type {DayCell} from '../../core/daily/dailyLog';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {useAppNavigation, type RootStackParamList} from '../../core/navigation';
import {useCreateParty} from '../../core/rooms/useCreateParty';
import {radii, spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {friendCellsFor, friendStreak} from '../social/PersonCard';
import {FriendTodayCard} from './FriendTodayCard';

/** Fraction of the screen a friend card fills, so the next card peeks (~1.5). */
const CARD_FRACTION = 0.78;

/** Each daily's own screen route (mirrors GamesScreen.handleSelect). */
const ROUTE: Record<DailyGame, keyof RootStackParamList> = {
  scout: 'Scout',
  tenball: 'TopBins',
  journeyman: 'Journeyman',
  teamsheet: 'Teamsheet',
};

export function HomeScreen({
  onOpenFriends,
}: {
  /** Jump the tab shell to the Friends tab (from the carousel / add-friends card). */
  onOpenFriends?: () => void;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const navigation = useAppNavigation();
  const {createParty, busy} = useCreateParty();
  const {width} = useWindowDimensions();
  const todayKey = dateKeyFor(new Date());

  const [cells, setCells] = useState<Record<DailyGame, DayCell> | null>(null);
  const [streak, setStreak] = useState(0);
  // All friends, ordered players-first; null until the first load resolves.
  const [friends, setFriends] = useState<FriendFeed[] | null>(null);

  const cardWidth = Math.round(width * CARD_FRACTION);

  // Reload on focus so a daily just played (pushed over the shell, then popped)
  // shows its new state the moment we return.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const today = dateKeyFor(new Date());
      loadDailyLog(today)
        .then(log => {
          if (!alive) {
            return;
          }
          setCells(log.days[0]?.cells ?? null);
          // The streak moment shows the strongest live streak across the four.
          setStreak(
            Math.max(0, ...DAILY_GAMES.map(g => log.streaks[g].current)),
          );
        })
        .catch(() => {});
      // All friends, ordered so whoever played today leads the carousel. Silent
      // on failure (keeps whatever's shown); [] means "no friends" → add card.
      fetchFriendsFeed(today)
        .then(feed => {
          if (!alive) {
            return;
          }
          const playedToday = (f: FriendFeed) =>
            f.results.some(r => r.dateKey === today);
          const sorted = [...feed].sort(
            (a, b) => Number(playedToday(b)) - Number(playedToday(a)),
          );
          setFriends(sorted);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header — the "m." brand mark + the streak flame (hidden at zero). */}
        <View style={styles.header}>
          <AppMark size={28} />
          {streak > 0 ? (
            <View
              style={styles.streak}
              accessibilityRole="text"
              accessibilityLabel={t('home.streakLabel', {count: streak})}>
              <Flame size={16} color={colors.primary} strokeWidth={2} />
              <Text variant="label" color="primary">
                {streak}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Today — the four dailies as tappable status rows. */}
        <Text variant="section" style={styles.sectionHeading}>
          {t('home.today')}
        </Text>
        <View style={styles.card}>
          {DAILY_GAMES.map((game, i) => {
            const cell = cells?.[game];
            const isLast = i === DAILY_GAMES.length - 1;
            return (
              <PressableScale
                key={game}
                onPress={() => navigation.navigate(ROUTE[game] as never)}
                accessibilityRole="button">
                {/* DailyRow keeps its own layout; the chevron is a trailing
                    "go" affordance, so the divider spans the full row width. */}
                <View style={[styles.dailyItem, !isLast && styles.dailyDivider]}>
                  <View style={styles.flex}>
                    <DailyRow
                      game={game}
                      status={cell?.status ?? 'notPlayed'}
                      right={cell?.right ?? null}
                      wrong={cell?.wrong ?? null}
                      isLast
                    />
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    strokeWidth={2}
                  />
                </View>
              </PressableScale>
            );
          })}
        </View>

        {/* Play with friends — the party quick actions. */}
        <Text variant="section" style={styles.sectionHeading}>
          {t('home.playWithFriends')}
        </Text>
        <View style={styles.actions}>
          <Button
            label={busy ? t('home.creating') : t('home.createParty')}
            variant="primary"
            onPress={() => createParty()}
            disabled={busy}
            trailingIcon={
              <ChevronRight size={20} color={colors.onInk} strokeWidth={2.25} />
            }
          />
          <Button
            label={t('home.joinParty')}
            variant="secondary"
            onPress={() => navigation.navigate('Join')}
            style={{borderColor: colors.primary}}
          />
        </View>

        {/* Friends today — the Social slice: a horizontal carousel of friends'
            unfolded day cards (players-first). No friends at all → an add card;
            still loading (null) → render nothing yet. */}
        {friends !== null ? (
          <>
            <Text variant="section" style={styles.sectionHeading}>
              {t('home.friendsToday')}
            </Text>
            {friends.length === 0 ? (
              // Empty state: nudge to add friends (opens the Friends tab).
              <PressableScale
                style={styles.addCard}
                onPress={onOpenFriends}
                accessibilityRole="button"
                accessibilityLabel={t('home.addFriends')}>
                <UserPlus size={22} color={colors.primary} strokeWidth={2} />
                <View style={styles.flex}>
                  <Text variant="label">{t('home.addFriends')}</Text>
                  <Text variant="caption" color="secondary">
                    {t('home.addFriendsBody')}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
              </PressableScale>
            ) : (
              <ScrollView
                horizontal
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToAlignment="start"
                snapToInterval={cardWidth + spacing.md}>
                {friends.map(f => (
                  <FriendTodayCard
                    key={f.profile.userId}
                    name={f.profile.displayName}
                    avatarUri={avatarUrlFor(f.profile.avatarPath)}
                    presence={presenceFor(f.profile.lastSeenAt, Date.now())}
                    streak={friendStreak(f.results, todayKey)}
                    today={friendCellsFor(f.results, todayKey)}
                    width={cardWidth}
                    onPress={() =>
                      navigation.navigate('FriendProfile', {profile: f.profile})
                    }
                  />
                ))}
              </ScrollView>
            )}
          </>
        ) : null}

        {/* Scan to get the app — the App Store QR. */}
        <View style={styles.qr}>
          <QrCard value={APP_STORE_URL} caption={t('home.scanApp')} />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: c.background},
    flex: {flex: 1},
    content: {paddingHorizontal: spacing.xl},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    // Flame + count pill: a quiet neutral well so the accent reads as the number.
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    sectionHeading: {marginTop: spacing.xxl, marginBottom: spacing.md},
    // Content card: sunken ground + a hairline inset border.
    card: {
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
    },
    // Row = the daily's content (flex) + a trailing chevron; the hairline sits
    // on this wrapper so it runs the card's full width, chevron included.
    dailyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dailyDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.glassRim,
    },
    actions: {gap: spacing.sm + 2},
    // Full-bleed: cancel the content's side padding so cards scroll edge-to-edge,
    // then re-inset the content so the first card lines up with everything else.
    carousel: {marginHorizontal: -spacing.xl},
    carouselContent: {paddingHorizontal: spacing.xl, gap: spacing.md},
    // Empty-state add-friends card (same sunken recipe as the Today card).
    addCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    qr: {marginTop: spacing.xxl, alignItems: 'center'},
  });
