import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
// Gesture-handler's ScrollView so a card's swipe-right pan and the vertical
// scroll arbitrate natively (the swipe reveals "play on 1 device").
import {ScrollView} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {
  ChevronRight,
  Hash,
  Plus,
  Smartphone,
  Swords,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Button,
  GlassCard,
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
import {fetchMyValue, type MyValue} from '../../core/rooms/rankedService';
import {formatDelta, formatValue} from '../../games/ranked-hattrick/value';
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
                leadingIcon={<Swords size={18} color="#FFFFFF" strokeWidth={2} />}
              />
              <Button
                label={t('play.leaderboard')}
                variant="outline"
                onPress={comingSoon}
                leadingIcon={<Trophy size={18} color="#A3A3A3" strokeWidth={2} />}
              />
            </View>
            <Text variant="caption" color="muted" align="center" style={styles.footnote}>
              {t('play.rankedHattrickMeta')}
            </Text>
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
        <Icon size={26} color="#FFFFFF" strokeWidth={2} />
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

/** Competitive stat card — labelled as the ranked Hattrick ladder — with the
 * placeholder Rating / Value / recent-trend. */
/** Count 0 → target on an ease-in (slow → quick) curve; re-runs when `trigger`
 * changes (each time the Competitive tab is focused). */
function useCountUp(target: number | null, trigger: number): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null) {
      setVal(0);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const dur = 700;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setVal(Math.round(target * (p * p))); // easeInQuad
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, trigger]);
  return val;
}

function ValueCard() {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const Icon = hattrickIcon();
  const [data, setData] = useState<MyValue | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  // Refresh + replay the count-up on focus (a match just played updates it).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setFocusKey(k => k + 1);
      fetchMyValue()
        .then(v => {
          if (alive) {
            setData(v);
          }
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const shown = useCountUp(data ? data.value : null, focusKey);
  const trend = data?.trend ?? 0;
  const trendUp = trend >= 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;
  const trendColor = trendUp ? colors.success : colors.error;
  return (
    <GlassCard style={styles.statCard}>
      <View style={styles.eyebrowRow}>
        <Icon size={15} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.eyebrow}>{t('play.rankedHattrick')}</Text>
      </View>
      <Text variant="caption" color="muted">
        {t('play.value')}
      </Text>
      <Text style={[styles.valueBig, {color: colors.primary}]}>
        {data ? formatValue(shown) : '—'}
      </Text>
      {data && data.games > 0 && trend !== 0 ? (
        <View style={styles.trendRow}>
          <TrendIcon size={16} color={trendColor} strokeWidth={2} />
          <Text variant="secondary" style={{color: trendColor}}>
            {t('play.trend', {
              delta: formatDelta(trend),
              count: Math.min(data.games, 5),
            })}
          </Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scroll: {flex: 1},
    header: {height: 44, alignItems: 'center', justifyContent: 'center'},
    toggle: {marginTop: spacing.md},
    ctaGroup: {marginTop: spacing.xl, gap: spacing.sm},
    competitiveTop: {marginTop: spacing.xl},
    footnote: {marginTop: spacing.md},
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
    // Game row: surface + hairline rim, no frost, no coloured fill.
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: StyleSheet.hairlineWidth,
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
    // Competitive stat card (GlassCard = solid surface, no blur).
    statCard: {padding: spacing.lg, gap: spacing.md},
    eyebrowRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
    eyebrow: {
      fontFamily: fonts.medium,
      fontSize: 12,
      letterSpacing: 0.6,
      color: c.textTertiary,
      textTransform: 'uppercase',
    },
    statRow: {flexDirection: 'row', justifyContent: 'space-between'},
    statRight: {alignItems: 'flex-end'},
    statBig: {
      fontFamily: fonts.medium,
      fontSize: 30,
      lineHeight: 36,
      color: c.ink,
      fontVariant: ['tabular-nums'],
    },
    valueBig: {
      fontFamily: fonts.medium,
      fontSize: 38,
      lineHeight: 44,
      color: c.ink,
      fontVariant: ['tabular-nums'],
    },
    trendRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  });
