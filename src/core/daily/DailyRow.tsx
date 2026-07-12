/**
 * DailyRow — one game's state on one day, as a full-width list row. The
 * shared unit of the daily archive language, used inside the Log tab's day
 * cards and the Friends tab's person cards, so both surfaces read
 * identically: dimmed = not started, eye + tries = ongoing, green check +
 * tries = solved, red cross + tries = surrendered.
 *
 * Deliberately a plain row, not a pill: pills nested inside a glass card
 * squeeze the game name and the answer into half-width and read as glass on
 * glass. A row gives the title and the answer the card's full width.
 *
 * `answer` renders as a second line (the player/team behind a finished day)
 * and is only ever passed on the owner's own rows — published data cannot
 * carry it.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {
  Ban,
  Check,
  ClipboardList,
  Eye,
  ListOrdered,
  Route,
  UserSearch,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import {Text} from '../ui';
import {colors, spacing} from '../../theme';
import type {DailyGame, DayCellStatus} from './dailyLog';

/** Per-game presentation: the hub tile's icon (gamesCatalog) + title key. */
export const GAME_META: Record<DailyGame, {Icon: LucideIcon; titleKey: string}> = {
  scout: {Icon: UserSearch, titleKey: 'games.scout.title'},
  tenball: {Icon: ListOrdered, titleKey: 'games.tenball.title'},
  journeyman: {Icon: Route, titleKey: 'games.journeyman.title'},
  teamsheet: {Icon: ClipboardList, titleKey: 'games.teamsheet.title'},
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
  /** Correct answers so far (ongoing) or final (finished); null when not played. */
  right: number | null;
  /** Wrong guesses so far (ongoing) or final (finished); null when not played. */
  wrong: number | null;
  /** Owner-only: the finished day's player/team/list, shown as a second line. */
  answer?: string | null;
  /** The last row in a card drops its divider (MenuRow convention). */
  isLast?: boolean;
};

export function DailyRow({game, status, right, wrong, answer = null, isLast = false}: Props) {
  const {t} = useTranslation();
  const {Icon, titleKey} = GAME_META[game];
  const title = t(titleKey);
  const played = status !== 'notPlayed';
  const hasScore = played && right !== null && wrong !== null;

  const parts = [t(STATUS_A11Y[status], {game: title})];
  if (hasScore) {
    parts.push(t('dailyLog.a11yScore', {right, wrong}));
  }
  if (answer) {
    parts.push(answer);
  }

  return (
    <View
      style={[styles.row, !isLast && styles.divider, !played && styles.dim]}
      accessible
      accessibilityLabel={parts.join(', ')}>
      <Icon
        size={16}
        color={played ? colors.ink : colors.textTertiary}
        strokeWidth={2}
      />
      <View style={styles.text}>
        <Text
          variant="secondary"
          color={played ? 'primary' : 'tertiary'}
          numberOfLines={1}>
          {title}
        </Text>
        {answer ? (
          <Text variant="caption" color="tertiary" numberOfLines={1}>
            {answer}
          </Text>
        ) : null}
      </View>
      {played ? (
        <View style={styles.state}>
          {status === 'won' ? (
            <Check size={14} color={colors.success} strokeWidth={2.5} />
          ) : status === 'revealed' ? (
            <X size={14} color={colors.error} strokeWidth={2.5} />
          ) : (
            <Eye size={14} color={colors.textSecondary} strokeWidth={2} />
          )}
          {hasScore ? (
            <>
              <Text variant="secondary" color="secondary">
                {right}
              </Text>
              <Ban size={13} color={colors.error} strokeWidth={2} />
              <Text variant="secondary" color="secondary">
                {wrong}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    // Bright hairline matching the card rim, same recipe as MenuRow dividers.
    borderBottomColor: colors.glassRim,
  },
  dim: {opacity: 0.45},
  text: {flex: 1},
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
