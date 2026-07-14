/**
 * Home — the app's front door.
 *
 * Grouping follows the welcome page's grammar: a BIG gap (xxl) starts a new
 * group, small gaps (xs–md) keep a group's own members tight, and space does
 * the separating — no section chrome between the hello, the card and the
 * buttons.
 *
 *   Header   brand mark + the streak flame (hidden at zero)
 *   Hello    greeting + today's date, tight pair
 *   Daily    brand-gradient card listing the dailies still waiting; each row
 *            is its own button straight into that game (MenuRow dividers)
 *   Match    Create match / Join match, tight pair
 *   Friends  heading + carousel of friends' unfolded day cards
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useFocusEffect} from '@react-navigation/native';
import {ChevronRight, Timer} from 'lucide-react-native';
import {Button, CircleButton, PressableScale, Text} from '../../core/ui';
import {radii, screenPadding, spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {getCachedProfile, avatarUrlFor, fetchFriendsFeed} from '../../core/social/socialService';
import {presenceFor} from '../../core/social/presence';
import type {FriendFeed} from '../../core/social/types';
import {loadDailyLog, DAILY_GAMES, type DailyGame} from '../../core/daily/dailyLog';
import {GAME_META} from '../../core/daily/DailyRow';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {useAppNavigation, type RootStackParamList} from '../../core/navigation';
import {useCreateParty} from '../../core/rooms/useCreateParty';
import {friendCellsFor, friendStreak} from '../social/PersonCard';
import {FriendTodayCard} from '../home/FriendTodayCard';
import {TabPage} from './TabPage';

/** Fraction of the screen a friend card fills, so the next card peeks. */
const CARD_FRACTION = 0.78;

/** Translucent ink for the card's quieter lines (onInk at reduced strength). */
const CARD_INK_SOFT = 'rgba(245,245,245,0.85)';

/** Each daily's own screen route. */
const ROUTE: Record<DailyGame, keyof RootStackParamList> = {
  scout: 'Scout',
  tenball: 'TopBins',
  journeyman: 'Journeyman',
  teamsheet: 'Teamsheet',
};

function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return 'home.greetingMorning';
  }
  if (hour >= 12 && hour < 17) {
    return 'home.greetingAfternoon';
  }
  if (hour >= 17 && hour < 22) {
    return 'home.greetingEvening';
  }
  return 'home.greetingNight';
}

/** Milliseconds from `now` to the next local midnight (the daily rollover). */
function msToNextDay(now: Date): number {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return next.getTime() - now.getTime();
}

/** `H:MM:SS` for a remaining span, floored at zero. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}`;
}

/**
 * The live countdown to tomorrow's dailies, ticking its own second so only the
 * clock re-renders each tick, not the whole Home page. Bright ink on the card's
 * gradient, tabular figures so the digits don't jitter.
 */
function NextDropCountdown() {
  const styles = useThemedStyles(makeStyles);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Text variant="secondary" style={styles.countdown}>
      {formatCountdown(msToNextDay(now))}
    </Text>
  );
}

export function HomeTab(): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const {t} = useTranslation();
  const navigation = useAppNavigation();
  const {createParty, busy} = useCreateParty();
  const {width} = useWindowDimensions();
  const todayKey = dateKeyFor(new Date());

  const [name, setName] = useState<string | null>(null);
  // The dailies not finished today (in DAILY_GAMES order); null until loaded.
  const [waiting, setWaiting] = useState<DailyGame[] | null>(null);
  const [friends, setFriends] = useState<FriendFeed[] | null>(null);

  const friendCardWidth = Math.round(width * CARD_FRACTION);

  useEffect(() => {
    getCachedProfile()
      .then(p => setName(p?.displayName ?? null))
      .catch(() => {});
  }, []);

  // Reload on focus so a daily just played (pushed over the shell, then
  // popped) leaves the card's list the moment we return.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const today = dateKeyFor(new Date());
      loadDailyLog(today)
        .then(log => {
          if (!alive) {
            return;
          }
          const cells = log.days[0]?.cells;
          setWaiting(
            DAILY_GAMES.filter(g => {
              const status = cells?.[g]?.status ?? 'notPlayed';
              return status === 'notPlayed' || status === 'ongoing';
            }),
          );
        })
        .catch(() => {});
      // Only friends who played or started a game today, most games first
      // (then highest streak). Silent on failure.
      fetchFriendsFeed(today)
        .then(feed => {
          if (!alive) {
            return;
          }
          const todayRows = (f: FriendFeed) =>
            f.results.filter(r => r.dateKey === today);
          setFriends(
            feed
              .filter(f => todayRows(f).length > 0)
              .sort((a, b) => {
                const ga = todayRows(a).length;
                const gb = todayRows(b).length;
                if (gb !== ga) {
                  return gb - ga;
                }
                const sa = friendStreak(a.results, today);
                const sb = friendStreak(b.results, today);
                if (sb !== sa) {
                  return sb - sa;
                }
                return a.profile.displayName.localeCompare(b.profile.displayName);
              }),
          );
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const greeting = `${t(greetingKey(new Date().getHours()))}${
    name ? `, ${name}` : ''
  }`;
  // The greeting's quiet partner: friends' pulse today. "3 friends played
  // today · 2 online", either half alone, or nothing (line hidden).
  const playedCount =
    friends?.filter(f => f.results.some(r => r.dateKey === todayKey)).length ??
    0;
  const onlineCount =
    friends?.filter(f => presenceFor(f.profile.lastSeenAt, Date.now()).online)
      .length ?? 0;
  const playedLine =
    playedCount === 1
      ? t('home.friendPlayedOne')
      : playedCount > 1
        ? t('home.friendsPlayed', {count: playedCount})
        : '';
  const onlineLine =
    onlineCount === 1
      ? t('home.friendOnlineOne')
      : onlineCount > 1
        ? t('home.friendsOnline', {count: onlineCount})
        : '';
  const friendsPulse =
    playedLine && onlineCount > 0
      ? `${playedLine} · ${t('home.friendsOnlineShort', {count: onlineCount})}`
      : playedLine || onlineLine;

  // The day is cleared once nothing is waiting; until then the headline counts
  // what's left.
  const allDone = waiting !== null && waiting.length === 0;
  const waitingHeadline =
    waiting === null || waiting.length === 0
      ? ''
      : waiting.length === 1
        ? t('home.dailyWaitingOne')
        : t('home.dailiesWaiting', {count: waiting.length});

  return (
    <TabPage
      right={
        // TODO(sitemap): inert until the new help page exists — the corner
        // claims its spot so the header doesn't shift when it goes live.
        <CircleButton size={30} accessibilityLabel={t('home.help')}>
          <Text variant="label" color="secondary">
            ?
          </Text>
        </CircleButton>
      }>
      {/* Hello — greeting + the friends pulse, one tight pair. */}
      <Text variant="title" style={styles.greeting}>
        {greeting}
      </Text>
      {friendsPulse ? (
        <Text variant="secondary" color="secondary" style={styles.subline}>
          {friendsPulse}
        </Text>
      ) : null}

      {/* The daily card: the headline counts the dailies still open, and each
          row under it is a button straight into that game. */}
      <View style={styles.card}>
        <View style={styles.cardInner}>
          {allDone ? (
            // Cleared the lot: a warm sign-off and a live countdown to the next
            // drop, in place of the waiting list.
            <>
              <Text variant="secondary" style={styles.doneLead}>
                {t('home.dailiesDoneLead')}
              </Text>
              <Text variant="wordmark" color="onInk">
                {name
                  ? t('home.dailiesDoneBye', {name})
                  : t('home.dailiesDoneByeAnon')}
              </Text>
              <View style={styles.doneTimer}>
                <Timer size={14} color={CARD_INK_SOFT} strokeWidth={2} />
                <Text variant="secondary" style={styles.doneTimerLabel}>
                  {t('daily.nextLabel')}
                </Text>
                <NextDropCountdown />
              </View>
            </>
          ) : (
            <>
              <Text variant="wordmark" color="onInk">
                {waitingHeadline}
              </Text>
              {waiting && waiting.length > 0 ? (
                <View style={styles.cardList}>
                  {waiting.map((g, i) => {
                    const {Icon, titleKey} = GAME_META[g];
                    const isLast = i === waiting.length - 1;
                    return (
                      <PressableScale
                        key={g}
                        onPress={() => navigation.navigate(ROUTE[g] as never)}
                        accessibilityRole="button"
                        accessibilityLabel={t(titleKey)}
                        style={[styles.cardRow, !isLast && styles.cardDivider]}>
                        <Icon size={15} color={CARD_INK_SOFT} strokeWidth={2} />
                        <Text variant="body" style={styles.cardRowText}>
                          {t(titleKey)}
                        </Text>
                        <View style={styles.flex} />
                        <ChevronRight
                          size={16}
                          color={CARD_INK_SOFT}
                          strokeWidth={2}
                        />
                      </PressableScale>
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* Match — the two quick actions, one tight pair. */}
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
        />
      </View>

      {/* Friends feed — heading + carousel. Hidden until there are friends
          (no dead-end empty state on the new sitemap yet). */}
      {friends !== null && friends.length > 0 ? (
        <>
          <Text variant="section" style={styles.sectionHeading}>
            {t('home.friendsToday')}
          </Text>
          <ScrollView
            horizontal
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={friendCardWidth + spacing.md}>
            {friends.map(f => (
              <FriendTodayCard
                key={f.profile.userId}
                name={f.profile.displayName}
                avatarUri={avatarUrlFor(f.profile.avatarPath)}
                presence={presenceFor(f.profile.lastSeenAt, Date.now())}
                streak={friendStreak(f.results, todayKey)}
                today={friendCellsFor(f.results, todayKey)}
                width={friendCardWidth}
                onPress={() =>
                  navigation.navigate('FriendProfile', {profile: f.profile})
                }
              />
            ))}
          </ScrollView>
        </>
      ) : null}
    </TabPage>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    flex: {flex: 1},
    // Chrome (the scroll-away brand header) → content: slightly under a group
    // gap, then the date hugs its greeting.
    greeting: {marginTop: spacing.xl},
    subline: {marginTop: spacing.xs},
    // New group. The card's height hugs its content (NO flex on the inner —
    // that collapses to minHeight and clips the list). One solid brand fill.
    card: {
      marginTop: spacing.xxl,
      borderRadius: radii.card,
      overflow: 'hidden',
      backgroundColor: c.primary,
    },
    // minHeight keeps the "all done" state from collapsing into a strip.
    cardInner: {
      minHeight: 148,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    cardList: {marginTop: spacing.xs},
    // All-done: a soft eyebrow above the personal sign-off, then the timer.
    doneLead: {color: CARD_INK_SOFT, marginBottom: spacing.xs},
    doneTimer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      marginTop: spacing.md,
    },
    doneTimerLabel: {color: CARD_INK_SOFT},
    countdown: {color: c.onInk, fontVariant: ['tabular-nums']},
    // Icon + title + chevron; paddingVertical clears a 44pt tap target.
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    // MenuRow convention: hairline under every row but the last. Translucent
    // ink so it reads on the gradient.
    cardDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(245,245,245,0.35)',
    },
    cardRowText: {color: CARD_INK_SOFT},
    // New group; the two buttons stay a tight pair.
    actions: {marginTop: spacing.xxl, gap: spacing.sm + 2},
    // New group; the heading hugs its carousel.
    sectionHeading: {marginTop: spacing.xxl, marginBottom: spacing.md},
    // Full-bleed: cancel the screen's side padding so cards scroll
    // edge-to-edge, then re-inset so the first card lines up with the rest.
    carousel: {marginHorizontal: -screenPadding},
    carouselContent: {paddingHorizontal: screenPadding, gap: spacing.md},
  });
