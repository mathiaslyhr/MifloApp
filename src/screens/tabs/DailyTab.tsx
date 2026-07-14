/**
 * Daily — the solo dailies' home. A showcase of all four daily games as
 * full-status cards: icon, title, tagline, today's status (glyph + right/wrong)
 * and the streak flame. Every card is one tap into that game's own screen.
 *
 * Unlike Home — which lists only the dailies still waiting — this tab always
 * shows all four, finished ones included, so it reads as today's dashboard.
 * Read-only over `loadDailyLog`; it reloads on focus so a game just played
 * (pushed over the shell, then popped) updates its card the moment we return.
 */
import React, {useCallback, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useFocusEffect} from '@react-navigation/native';
import {
  Check,
  ChevronRight,
  Eye,
  Flag,
  Flame,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import {PressableScale, Text} from '../../core/ui';
import {radii, spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {
  loadDailyLog,
  DAILY_GAMES,
  type DailyGame,
  type DailyLog,
  type DayCell,
  type DayCellStatus,
} from '../../core/daily/dailyLog';
import {GAME_META} from '../../core/daily/DailyRow';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {useAppNavigation, type RootStackParamList} from '../../core/navigation';
import {TabPage} from './TabPage';

/** Each daily's own screen route. */
const ROUTE: Record<DailyGame, keyof RootStackParamList> = {
  scout: 'Scout',
  tenball: 'TopBins',
  journeyman: 'Journeyman',
  teamsheet: 'Teamsheet',
};

export function DailyTab() {
  const styles = useThemedStyles(makeStyles);
  const {t} = useTranslation();
  const navigation = useAppNavigation();
  const [log, setLog] = useState<DailyLog | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadDailyLog(dateKeyFor(new Date()))
        .then(next => {
          if (alive) {
            setLog(next);
          }
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const cells = log?.days[0]?.cells ?? null;

  return (
    <TabPage title={t('tabs.daily')}>
      <View style={styles.list}>
        {DAILY_GAMES.map(game => (
          <DailyGameCard
            key={game}
            game={game}
            cell={cells?.[game] ?? null}
            streak={log?.streaks[game].current ?? 0}
            onPress={() => navigation.navigate(ROUTE[game] as never)}
          />
        ))}
      </View>
    </TabPage>
  );
}

/** The status glyph + label + counts for a card's third line. */
type StatusFace = {
  Icon: LucideIcon;
  labelKey: string;
  tone: 'success' | 'error' | 'secondary';
};

const FACE: Record<Exclude<DayCellStatus, 'notPlayed'>, StatusFace> = {
  won: {Icon: Check, labelKey: 'daily.solved', tone: 'success'},
  revealed: {Icon: Flag, labelKey: 'daily.surrendered', tone: 'error'},
  ongoing: {Icon: Eye, labelKey: 'daily.ongoing', tone: 'secondary'},
};

type CardProps = {
  game: DailyGame;
  /** Today's cell, or null before the log has loaded. */
  cell: DayCell | null;
  streak: number;
  onPress: () => void;
};

function DailyGameCard({game, cell, streak, onPress}: CardProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const {t} = useTranslation();
  const {Icon, titleKey} = GAME_META[game];

  const status: DayCellStatus = cell?.status ?? 'notPlayed';
  const played = status !== 'notPlayed';
  // The green check means "solved it", impossible without at least one correct
  // answer: a 'won' cell with right < 1 (a guess-one win that never recorded
  // its 1, or a legacy row) shows the eye instead, never a hollow check. Same
  // guard DailyRow uses, so the two surfaces always agree.
  const displayStatus: DayCellStatus =
    status === 'won' && (cell?.right ?? 0) < 1 ? 'ongoing' : status;
  const hasScore =
    played && cell?.right !== null && cell?.right !== undefined && cell?.wrong !== null;
  const face = displayStatus === 'notPlayed' ? null : FACE[displayStatus];
  const toneColor = {
    success: colors.success,
    error: colors.error,
    secondary: colors.textSecondary,
  };

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(titleKey)}
      style={[styles.card, !played && styles.cardDim]}>
      {/* Top row: game icon + title, then the streak flame and the chevron. */}
      <View style={styles.top}>
        <Icon size={20} color={colors.ink} strokeWidth={2} />
        <Text variant="section" style={styles.title} numberOfLines={1}>
          {t(titleKey)}
        </Text>
        {streak > 0 ? (
          <View style={styles.streak}>
            <Flame size={14} color={colors.primaryInk} strokeWidth={2} />
            <Text variant="secondary" color="accent" style={styles.streakCount}>
              {streak}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
      </View>

      {/* The tagline. */}
      <Text variant="secondary" color="secondary" style={styles.tagline} numberOfLines={1}>
        {t(`games.${game}.tagline`)}
      </Text>

      {/* State footer: today's outcome, set off from the game's identity by a
          hairline. Outcome on the left, the score anchored to the trailing
          edge so it reads as one figure, not glyphs floating mid-row. */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {face ? (
            <face.Icon size={14} color={toneColor[face.tone]} strokeWidth={2.5} />
          ) : (
            <View style={[styles.dot, {backgroundColor: colors.textTertiary}]} />
          )}
          <Text variant="secondary" color={face ? 'secondary' : 'tertiary'}>
            {t(face ? face.labelKey : 'daily.notPlayed')}
          </Text>
        </View>
        {hasScore ? (
          <View style={styles.counts}>
            <Check size={13} color={colors.success} strokeWidth={2.5} />
            <Text variant="secondary" color="secondary" style={styles.count}>
              {cell?.right}
            </Text>
            <View style={styles.countGap} />
            <X size={13} color={colors.error} strokeWidth={2.5} />
            <Text variant="secondary" color="secondary" style={styles.count}>
              {cell?.wrong}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // A new group under the scroll-away header, then the cards stack tight.
    list: {marginTop: spacing.xl, gap: spacing.md},
    // Elevation = brightness: the surface-1 fill on the darker page already
    // reads as lifted, so no rim — the card needs no outline.
    card: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm + 2,
    },
    cardDim: {opacity: 0.7},
    top: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    title: {flex: 1},
    streak: {flexDirection: 'row', alignItems: 'center', gap: 3},
    streakCount: {fontVariant: ['tabular-nums']},
    tagline: {marginTop: 2},
    // The identity (icon/title/tagline) above, today's state below, parted by a
    // hairline in the same recipe as the card rim. Outcome and score sit as one
    // left-anchored cluster — the gap keeps them a group, not two strangers at
    // opposite ends of the row.
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    footerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
    },
    dot: {width: 7, height: 7, borderRadius: 999},
    counts: {flexDirection: 'row', alignItems: 'center', gap: 3},
    count: {fontVariant: ['tabular-nums']},
    // Separates the correct group from the miss group, like DailyRow's state gap.
    countGap: {width: spacing.xs},
  });
