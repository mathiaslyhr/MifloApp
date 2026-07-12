/**
 * DailyRow — one game's state on one day, as a full-width list row. The
 * shared unit of the daily archive language, used inside the Log tab's day
 * cards and the Friends tab's person cards, so both surfaces read identically.
 * Status glyph: dimmed = not started, eye = ongoing, green check = solved, red
 * flag = surrendered or rolled over unfinished. Then the right/wrong counts:
 * the correct count, a red cross (miss mark), the wrong count.
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
  Check,
  ClipboardList,
  Eye,
  Flag,
  ListOrdered,
  Route,
  UserSearch,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import {Text} from '../ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const {Icon, titleKey} = GAME_META[game];
  const title = t(titleKey);
  const played = status !== 'notPlayed';
  const hasScore = played && right !== null && wrong !== null;

  // The green check means "solved it", which is impossible without at least one
  // correct answer. A 'won' row with a 0 right count (a legacy row from before
  // right counts, or a guess-one-player win that never recorded its 1) shows the
  // eye instead, never a hollow check. The surrender flag may still read 0.
  const displayStatus: DayCellStatus =
    status === 'won' && (right ?? 0) < 1 ? 'ongoing' : status;

  const parts = [t(STATUS_A11Y[displayStatus], {game: title})];
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
          {/* Group 1: outcome + correct count, tight so they read as one unit. */}
          <View style={styles.group}>
            {displayStatus === 'won' ? (
              <Check size={14} color={colors.success} strokeWidth={2.5} />
            ) : displayStatus === 'revealed' ? (
              <Flag size={14} color={colors.error} strokeWidth={2.5} />
            ) : (
              <Eye size={14} color={colors.textSecondary} strokeWidth={2} />
            )}
            {hasScore ? (
              <Text variant="secondary" color="secondary" style={styles.count}>
                {right}
              </Text>
            ) : null}
          </View>
          {/* Group 2: miss mark + wrong count, set apart by the wider state gap. */}
          {hasScore ? (
            <View style={styles.group}>
              <X size={13} color={colors.error} strokeWidth={2.5} />
              <Text variant="secondary" color="secondary" style={styles.count}>
                {wrong}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
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
    borderBottomColor: c.glassRim,
  },
  dim: {opacity: 0.45},
  text: {flex: 1},
  // The wider gap separates the two count groups; the row reads as
  // [outcome right] … [miss wrong], not four loose glyphs.
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Each group is icon + number, hugging tight so the number belongs to its
  // icon (a lone "1" no longer floats a slot-width away).
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  // Fixed-width, left-aligned tabular figures: the number sits next to its
  // icon, and the slot must be wide enough that a two-digit count still fits
  // INSIDE it — otherwise a wider "38" grows the cluster and, since it is
  // right-anchored, shoves that row's icons out of column. Sized for two
  // digits at 14px; left-align keeps the digit hugging its icon.
  count: {
    minWidth: 22,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
});
