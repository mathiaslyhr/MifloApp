import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
// Gesture-handler's ScrollView so a card's swipe-right pan and the vertical
// scroll arbitrate natively (the swipe reveals "play on 1 device").
import {ScrollView} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Hash,
  Plus,
  Smartphone,
  Swords,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Button,
  Card,
  NAV_HEIGHT,
  PressableScale,
  Screen,
  Segmented,
  SwipeReveal,
  closeOpenSwipeReveal,
  Text,
  toast,
} from '../../core/ui';
import {
  fonts,
  radii,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {useFocusEffect} from '@react-navigation/native';
import {useAppNavigation} from '../../core/navigation';
import {useCreateParty} from '../../core/rooms/useCreateParty';
import {
  fetchMyValue,
  peekCachedValue,
  readCachedValue,
  writeCachedValue,
  type MyValue,
} from '../../core/rooms/rankedService';
import {formatDelta, formatValue} from '../../games/ranked-hattrick/value';
import {VALUE_CAP} from '../../games/ranked-hattrick/constants';
import {GAMES, type GameEntry, type GameType} from '../gamesCatalog';

/** Solo daily games → their screens (mirrors DailyTab's ROUTE map). */
const DAILY_ROUTE: Record<string, string> = {
  scout: 'Scout',
  tenball: 'TopBins',
  journeyman: 'Journeyman',
  teamsheet: 'Teamsheet',
};

/** Roomless pass-and-play routes, revealed by the swipe on a Together card. */
const LOCAL_ROUTES: Record<string, string> = {
  hattrick: 'HattrickLocal',
  'red-card': 'RedCardLocal',
  offside: 'OffsideLocal',
  'cult-hero': 'CultHeroLocal',
};

const TOGETHER_GAMES = GAMES.filter(g => !g.single && g.available);
const DAILY_GAMES = GAMES.filter(g => g.single && g.available);

type Mode = 'friendlies' | 'competitive';

/** Play — the home for every game: casual "Friendlies" matches + solo dailies,
 * plus a "Competitive" ranked lane, played with Hattrick (UI only for now). */
export function PlayTab() {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const {createParty} = useCreateParty();
  const scrollRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<Mode>('friendlies');

  // The Value card only mounts on the Competitive segment. Warm its cache while
  // the user is still on Friendlies so the first switch paints from memory,
  // with no disk read of its own.
  useEffect(() => {
    readCachedValue();
  }, []);

  const openGame = (entry: GameEntry) => {
    if (entry.single) {
      const route = DAILY_ROUTE[entry.gameType];
      if (route) {
        navigation.navigate(route as never);
      }
      return;
    }
    // Multiplayer: mint a match locked to this game; the host gathers players in
    // the lobby. Error toasts are handled inside the hook.
    createParty(entry.gameType);
  };

  const openLocal = (gameType: GameType) => {
    const route = LOCAL_ROUTES[gameType];
    if (route) {
      navigation.navigate(route as never);
    }
  };

  const comingSoon = () => toast.neutral(t('play.comingSoon'));

  const countText = (entry: GameEntry): string | undefined => {
    if (entry.single) {
      return undefined;
    }
    if (entry.category === 'duel') {
      return t('play.players1v1');
    }
    return t('play.playersRange', {
      min: entry.minPlayers ?? 2,
      max: entry.maxPlayers ?? 8,
    });
  };

  return (
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
        }}
        onScrollBeginDrag={closeOpenSwipeReveal}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header scrolls off the top (canonical chrome). */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('tabs.play')}
          </Text>
        </View>

        <View style={styles.toggle}>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              {key: 'friendlies', label: t('play.friendlies'), Icon: Users},
              {key: 'competitive', label: t('play.competitive'), Icon: Swords},
            ]}
          />
        </View>

        {mode === 'friendlies' ? (
          <>
            <View style={styles.ctaGroup}>
              <Button
                label={t('play.createMatch')}
                onPress={() => createParty()}
                leadingIcon={<Plus size={18} color="#FFFFFF" strokeWidth={2} />}
              />
              <Button
                label={t('play.joinWithCode')}
                variant="outline"
                onPress={() => navigation.navigate('Join' as never)}
                leadingIcon={<Hash size={18} color="#A3A3A3" strokeWidth={2} />}
              />
            </View>

            <SectionLabel>{t('play.together')}</SectionLabel>
            <View style={styles.list}>
              {TOGETHER_GAMES.map(entry => (
                <GameRow
                  key={entry.gameType}
                  title={t(`games.${entry.i18nKey}.title`)}
                  subtitle={t(`games.${entry.i18nKey}.tagline`)}
                  Icon={entry.Icon}
                  count={countText(entry)}
                  onPress={() => openGame(entry)}
                  onLocal={
                    entry.localPlay ? () => openLocal(entry.gameType) : undefined
                  }
                  scrollRef={scrollRef}
                />
              ))}
            </View>

            <SectionLabel>{t('play.daily')}</SectionLabel>
            <View style={styles.list}>
              {DAILY_GAMES.map(entry => (
                <GameRow
                  key={entry.gameType}
                  title={t(`games.${entry.i18nKey}.title`)}
                  subtitle={t(`games.${entry.i18nKey}.tagline`)}
                  Icon={entry.Icon}
                  onPress={() => openGame(entry)}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.competitiveTop}>
              <ValueCard />
            </View>
            <View style={styles.ctaGroup}>
              <Button
                label={t('play.findMatch')}
                onPress={() => navigation.navigate('RankedSearch' as never)}
              />
              <Button
                label={t('play.leaderboard')}
                variant="secondary"
                onPress={comingSoon}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function hattrickIcon(): LucideIcon {
  return (GAMES.find(g => g.gameType === 'hattrick')?.Icon ?? Swords) as LucideIcon;
}

/** Small group heading — home-page grammar (big gap above, tight below). */
function SectionLabel({children}: {children: React.ReactNode}) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** One game row: a plain white icon (no square, no fill) + title + subtitle +
 * trailing count/chevron. When `onLocal` is set, a swipe-right reveals a
 * "1 device" pass-and-play action. */
function GameRow({
  title,
  subtitle,
  Icon,
  count,
  onPress,
  onLocal,
  scrollRef,
}: {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  count?: string;
  onPress: () => void;
  onLocal?: () => void;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const row = (
    <PressableScale
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}>
      <View style={styles.iconSlot}>
        {/* Every game reads white here: identity is the name and the icon, not
            a hue. Colour is saved for meaning inside the game. */}
        <Icon size={26} color={colors.ink} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text variant="section" numberOfLines={1} style={styles.cardTitle}>
          {title}
        </Text>
        <Text
          variant="secondary"
          color="secondary"
          numberOfLines={1}
          style={styles.cardSubtitle}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.trailing}>
        {count ? (
          <Text variant="caption" color="muted">
            {count}
          </Text>
        ) : null}
        <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
      </View>
    </PressableScale>
  );

  if (!onLocal) {
    return row;
  }
  return (
    <SwipeReveal
      Icon={Smartphone}
      label={t('games.oneDeviceShort')}
      actionAccessibilityLabel={t('games.localPlay')}
      onAction={onLocal}
      scrollRef={scrollRef}>
      {row}
    </SwipeReveal>
  );
}

/** A € swing worth animating: the match that just happened. */
type ValueChange = {from: number; to: number};

/** The shown €. Static at `target` unless a match actually moved it, in which
 * case it counts `from → to` on an ease-in (slow → quick) curve. Returns null
 * while the value is still loading. */
function useValueCountUp(
  target: number | null,
  change: ValueChange | null,
): number | null {
  const [val, setVal] = useState<number | null>(null);
  useEffect(() => {
    if (target == null) {
      setVal(null);
      return;
    }
    if (!change) {
      setVal(target); // nothing happened since last time: no motion.
      return;
    }
    let raf = 0;
    const start = Date.now();
    const dur = 900;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const eased = p * p; // easeInQuad
      setVal(Math.round(change.from + (change.to - change.from) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, change]);
  return val;
}

/** The last 5 results, oldest → newest (football form-guide order), padded on
 * the old side when they haven't played 5 yet. */
function formSlots(form: number[]): (number | null)[] {
  const played = form.slice(0, 5).reverse();
  return [...Array(Math.max(0, 5 - played.length)).fill(null), ...played];
}

/** The width of the % pill. Fixed on purpose: measuring it would make the
 * pill's `left` chase a second layout pass on every frame of the count-up.
 * "100%" is the widest label it can ever hold, and the digits are tabular. */
const PILL_W = 44;

/** The competitive card: your € value, how far that is toward peak value, and
 * how the last five went. The € only moves when a match moved it. */
function ValueCard() {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const Icon = hattrickIcon();
  // Seeded from memory so a reopen paints the real card on frame one — the €
  // barely moves between visits, so last-known is the honest thing to show
  // while the network confirms it.
  const [data, setData] = useState<MyValue | null>(peekCachedValue);
  const [change, setChange] = useState<ValueChange | null>(null);
  const [trackW, setTrackW] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        // Paint the disk's copy first (only ever awaited once per process),
        // then let the network correct it.
        const cached = await readCachedValue();
        if (!alive) {
          return;
        }
        setData(prev => prev ?? cached);
        try {
          const v = await fetchMyValue();
          if (!alive) {
            return;
          }
          // A € that differs from what this device last showed means a match
          // resolved while we were away: that, and only that, animates.
          const prev = cached?.value;
          setData(v);
          setChange(prev != null && prev !== v.value ? {from: prev, to: v.value} : null);
          await writeCachedValue(v);
        } catch {
          // Offline: the cached card stands rather than falling back to a shell.
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const shown = useValueCountUp(data ? data.value : null, change);

  // One long run from the floor to the €250M cap — no rungs. Driven by the
  // animated €, so the bar and the pill tick up with the count-up for free.
  const pct =
    shown != null ? Math.round(Math.max(0, Math.min(1, shown / VALUE_CAP)) * 100) : 0;
  // Centre the pill on the fill's end, but never let it hang off either edge:
  // a fresh €10M account sits at ~4%, where an uncentred pill would clip.
  const pillLeft = Math.max(
    0,
    Math.min(trackW - PILL_W, (pct / 100) * trackW - PILL_W / 2),
  );

  const delta = change ? change.to - change.from : 0;
  const up = delta >= 0;
  const DeltaIcon = up ? ArrowUpRight : ArrowDownRight;
  const deltaColor = up ? colors.success : colors.error;

  return (
    <Card style={styles.statCard}>
      <View style={styles.tagRow}>
        <Icon size={13} color={colors.textTertiary} strokeWidth={2} />
        <Text variant="caption" color="muted">
          {t('play.rankedHattrick')}
        </Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.valueBig, {color: colors.primary}]}>
          {shown != null ? formatValue(shown) : '—'}
        </Text>
        {change ? (
          <View style={styles.deltaChip}>
            <DeltaIcon size={15} color={deltaColor} strokeWidth={2.25} />
            <Text variant="secondary" style={{color: deltaColor}}>
              {formatDelta(delta)}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={styles.barRow}
        onLayout={e => setTrackW(e.nativeEvent.layout.width)}
        accessibilityRole="progressbar"
        accessibilityValue={{min: 0, max: 100, now: pct}}>
        <View style={styles.track}>
          <View
            style={[styles.trackFill, {width: `${pct}%`, backgroundColor: colors.primary}]}
          />
        </View>
        {trackW > 0 && shown != null ? (
          <View style={[styles.pctPill, {left: pillLeft, backgroundColor: colors.primary}]}>
            <Text style={styles.pctText}>{`${pct}%`}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statDivider} />
      <View style={styles.formRow}>
        <Text variant="caption" color="muted">
          {t('play.form')}
        </Text>
        <View style={styles.dots}>
          {formSlots(data?.form ?? []).map((d, i) => (
            <FormDot key={i} delta={d} />
          ))}
        </View>
      </View>
    </Card>
  );
}

/** One result in the form guide. `null` = not played yet (an empty ring). */
function FormDot({delta}: {delta: number | null}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (delta == null) {
    return <View style={[styles.dot, styles.dotEmpty]} />;
  }
  const color =
    delta > 0 ? colors.success : delta < 0 ? colors.error : colors.textTertiary;
  return <View style={[styles.dot, {backgroundColor: color}]} />;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scroll: {flex: 1},
    header: {height: 44, alignItems: 'center', justifyContent: 'center'},
    toggle: {marginTop: spacing.md},
    ctaGroup: {marginTop: spacing.xl, gap: spacing.sm},
    competitiveTop: {marginTop: spacing.xl},
    // Home-page grouping grammar: a big gap starts a new group, the heading
    // hugs its list.
    sectionLabel: {
      fontFamily: fonts.medium,
      fontSize: 13,
      letterSpacing: 0.4,
      color: c.textTertiary,
      textTransform: 'uppercase',
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    list: {gap: spacing.md},
    // Game row: surface + rim, no coloured fill.
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.divider,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    // Plain white icon, no square and no background.
    iconSlot: {width: 40, alignItems: 'center', justifyContent: 'center'},
    body: {flex: 1, gap: 2},
    cardTitle: {},
    cardSubtitle: {},
    trailing: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    // Competitive stat card (Card = solid surface, no blur).
    statCard: {padding: spacing.lg, gap: spacing.sm},
    // The game the card belongs to, quietly heading it.
    tagRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
    valueRow: {flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm},
    valueBig: {
      fontFamily: fonts.medium,
      fontSize: 38,
      lineHeight: 44,
      color: c.ink,
      fontVariant: ['tabular-nums'],
    },
    // Only shown right after a match: what that result was worth.
    deltaChip: {flexDirection: 'row', alignItems: 'center', gap: 2},
    // Progress toward the €250M cap. The row is pill-height so the pill can
    // overhang the track it rides on.
    barRow: {height: 22, justifyContent: 'center', marginTop: spacing.xs},
    track: {
      height: 6,
      borderRadius: radii.pill,
      backgroundColor: c.divider,
      overflow: 'hidden',
    },
    trackFill: {height: 6, borderRadius: radii.pill},
    // Same fill as the bar, so pill and fill read as one shape.
    pctPill: {
      position: 'absolute',
      width: PILL_W,
      height: 22,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pctText: {
      fontFamily: fonts.medium,
      fontSize: 12,
      // Must match fontSize: Text defaults to the `body` variant, whose
      // lineHeight (21) would otherwise drop the glyph to the bottom of its
      // line box. Digits and % have no descenders, so a tight box is safe.
      lineHeight: 12,
      color: c.onInk,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    statDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.divider,
      marginTop: spacing.sm,
    },
    formRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    dots: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
    dot: {width: 8, height: 8, borderRadius: 4},
    dotEmpty: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
    },
  });
