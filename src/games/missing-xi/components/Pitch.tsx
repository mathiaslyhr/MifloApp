import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '../../../core/ui';
import {colors, radii, spacing} from '../../../theme';
import type {LineupPlayer} from '../../../data/football';

type PitchProps = {
  players: LineupPlayer[];
  formation: string;
  hiddenIndex: number;
  /** When true (reveal), show the hidden player's name instead of a blank. */
  reveal?: boolean;
  /** Highlight the hidden slot green/red after the reveal. */
  guessedCorrectly?: boolean;
};

/**
 * Lays the eleven out in formation lines, forwards at the top down to the
 * keeper. Players are assumed listed in line order (GK, defence, midfield,
 * attack); the formation digits group the outfield rows. The hidden slot shows
 * a marker until the reveal.
 */
export function Pitch({
  players,
  formation,
  hiddenIndex,
  reveal,
  guessedCorrectly,
}: PitchProps) {
  const rows = groupIntoLines(players, formation);
  return (
    <View style={styles.pitch}>
      {/* Forwards first (top of the pitch), keeper last. */}
      {[...rows].reverse().map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map(({player, index}) => {
            const hidden = index === hiddenIndex;
            return (
              <View
                key={index}
                style={[
                  styles.slot,
                  hidden && styles.hiddenSlot,
                  hidden && reveal && (guessedCorrectly ? styles.correct : styles.wrong),
                ]}>
                <Text
                  variant="caption"
                  center
                  numberOfLines={1}
                  color={hidden && !reveal ? 'textSecondary' : 'textPrimary'}>
                  {hidden && !reveal ? '?' : player.name}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type Slot = {player: LineupPlayer; index: number};

/** Group players into formation lines: [GK], then one row per formation digit. */
function groupIntoLines(players: LineupPlayer[], formation: string): Slot[][] {
  const slots: Slot[] = players.map((player, index) => ({player, index}));
  const rows: Slot[][] = [];
  if (slots.length === 0) {
    return rows;
  }
  rows.push([slots[0]]); // keeper
  let offset = 1;
  const lines = formation.split('-').map(n => parseInt(n, 10)).filter(n => n > 0);
  for (const n of lines) {
    if (offset >= slots.length) {
      break;
    }
    rows.push(slots.slice(offset, offset + n));
    offset += n;
  }
  // Any leftover (formation/order mismatch) lands in a final row.
  if (offset < slots.length) {
    rows.push(slots.slice(offset));
  }
  return rows;
}

const styles = StyleSheet.create({
  pitch: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  slot: {
    flex: 1,
    maxWidth: 96,
    minHeight: 36,
    borderRadius: radii.button,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  hiddenSlot: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryMuted,
  },
  correct: {
    borderStyle: 'solid',
    borderColor: colors.success,
    backgroundColor: colors.successMuted,
  },
  wrong: {
    borderStyle: 'solid',
    borderColor: colors.error,
    backgroundColor: colors.errorMuted,
  },
});
