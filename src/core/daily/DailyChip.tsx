/**
 * DailyChip — one game's state on one day, the shared chip of the daily
 * archive language. Used by the Log tab (my history) and the Friends tab
 * (friend cards + the You card), so both surfaces read identically:
 * greyed out = not started, eye + tries = ongoing, green check + tries =
 * solved, red cross + tries = surrendered. `answer` renders a second line
 * (the player/team behind a finished day) and is only ever passed on the
 * owner's own chips — published data cannot carry it.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {
  Check,
  ClipboardList,
  Eye,
  ListOrdered,
  Route,
  UserSearch,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import {GlassTag, Text} from '../ui';
import {colors, spacing} from '../../theme';
import type {DailyGame, DayCellStatus} from './dailyLog';

/** Per-game presentation: the hub tile's icon (gamesCatalog) + title key, and
 * whether the count means guesses used or misses conceded. */
export const GAME_META: Record<
  DailyGame,
  {Icon: LucideIcon; titleKey: string; countKey: 'a11yGuesses' | 'a11yMisses'}
> = {
  scout: {Icon: UserSearch, titleKey: 'games.scout.title', countKey: 'a11yGuesses'},
  tenball: {Icon: ListOrdered, titleKey: 'games.tenball.title', countKey: 'a11yMisses'},
  journeyman: {Icon: Route, titleKey: 'games.journeyman.title', countKey: 'a11yGuesses'},
  teamsheet: {Icon: ClipboardList, titleKey: 'games.teamsheet.title', countKey: 'a11yMisses'},
};

const STATUS_A11Y: Record<DayCellStatus, string> = {
  won: 'dailyLog.a11yWon',
  revealed: 'dailyLog.a11ySurrendered',
  ongoing: 'dailyLog.a11yOngoing',
  notPlayed: 'dailyLog.a11yNotPlayed',
};

type Props = {
  game: DailyGame;
  status: DayCellStatus;
  /** Tries so far (ongoing) or final tries (finished); null when not played. */
  count: number | null;
  /** Owner-only: the finished day's player/team/list, shown as a second line. */
  answer?: string | null;
};

export function DailyChip({game, status, count, answer}: Props) {
  const {t} = useTranslation();
  const {Icon, titleKey, countKey} = GAME_META[game];
  const title = t(titleKey);
  const finished = status === 'won' || status === 'revealed';

  const parts = [t(STATUS_A11Y[status], {game: title})];
  if (count !== null && status !== 'notPlayed') {
    parts.push(t(`dailyLog.${countKey}`, {count}));
  }
  if (finished && answer) {
    parts.push(answer);
  }

  if (status === 'notPlayed') {
    return (
      <GlassTag size="sm" tint="light" style={[styles.chip, styles.dim]} accessibilityLabel={parts.join(', ')}>
        <Icon size={14} color={colors.textTertiary} strokeWidth={2} />
        <Text variant="caption" color="tertiary" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </GlassTag>
    );
  }

  return (
    <GlassTag size="sm" style={styles.chip} accessibilityLabel={parts.join(', ')}>
      <View style={styles.body}>
        <View style={styles.row}>
          <Icon
            size={14}
            color={finished ? colors.ink : colors.textSecondary}
            strokeWidth={2}
          />
          <Text
            variant="caption"
            color={finished ? 'primary' : 'secondary'}
            numberOfLines={1}
            style={styles.title}>
            {title}
          </Text>
          {status === 'won' ? (
            <Check size={12} color={colors.success} strokeWidth={2.5} />
          ) : status === 'revealed' ? (
            <X size={12} color={colors.error} strokeWidth={2.5} />
          ) : (
            <Eye size={12} color={colors.textSecondary} strokeWidth={2} />
          )}
          {count !== null ? (
            <Text variant="caption" color="secondary">
              {count}
            </Text>
          ) : null}
        </View>
        {finished && answer ? (
          <Text variant="caption" color="tertiary" numberOfLines={1}>
            {answer}
          </Text>
        ) : null}
      </View>
    </GlassTag>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  dim: {opacity: 0.45},
  // One column inside the pill: the state row, then the owner's answer line.
  body: {flex: 1, gap: 2},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {flex: 1},
});
