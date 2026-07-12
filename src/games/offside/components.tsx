/**
 * Offside presentational atoms: the 2×2 card grid, the countdown bar and the
 * reveal scoreboard. Pure display over plain props — no room, no engine, no
 * network.
 *
 * Cards deliberately show the NAME ONLY. Any attribute made visible (flag,
 * crest, position badge) would give away every round built on that attribute —
 * three matching flags answer a nationality round at a glance.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {Crown} from 'lucide-react-native';
import {GlassCard, Text} from '../../core/ui';
import {
  fonts,
  radii,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import type {OffsideCard} from './types';

/**
 * The four candidates. In the question phase (`correctIndex` null) cards are
 * tappable until a pick locks in; in the reveal the correct card glows green
 * and a wrong own pick red. Border width stays constant so state changes never
 * resize the tiles.
 */
export function CardGrid({
  cards,
  selectedIndex,
  correctIndex,
  disabled,
  onPick,
}: {
  cards: OffsideCard[];
  /** The local player's pick, if any. */
  selectedIndex: number | null;
  /** Set in the reveal phase; switches the grid to display-only. */
  correctIndex?: number | null;
  disabled?: boolean;
  onPick?: (index: number) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const revealing = correctIndex != null;
  return (
    <View style={styles.grid}>
      {cards.map((card, i) => {
        let border: string = colors.glassRim;
        if (revealing && i === correctIndex) {
          border = colors.success;
        } else if (revealing && i === selectedIndex) {
          border = colors.error;
        } else if (!revealing && i === selectedIndex) {
          border = colors.primary;
        }
        const tappable = !revealing && !disabled && selectedIndex == null;
        return (
          <Pressable
            key={card.footballerId}
            style={styles.cell}
            disabled={!tappable}
            onPress={() => onPick?.(i)}
            accessibilityRole="button"
            accessibilityLabel={card.name}>
            {({pressed}) => (
              <GlassCard
                borderWidth={2}
                borderColor={border}
                style={[styles.card, pressed && tappable && styles.cardPressed]}>
                <Text variant="section" align="center" style={styles.cardName}>
                  {card.name}
                </Text>
              </GlassCard>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Time draining out of the question — a thin bar that empties toward the
 * shared server deadline. Remount (key by round) to restart.
 */
export function CountdownBar({
  deadline,
  durationMs,
}: {
  /** Absolute deadline in epoch ms (server clock). */
  deadline: number;
  durationMs: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const fractionLeft = Math.max(
    0,
    Math.min(1, (deadline - Date.now()) / durationMs),
  );
  const width = useRef(new Animated.Value(fractionLeft)).current;

  useEffect(() => {
    const anim = Animated.timing(width, {
      toValue: 0,
      duration: Math.max(0, deadline - Date.now()),
      easing: t => t, // linear: the bar IS the clock
      useNativeDriver: false, // animates width
    });
    anim.start();
    return () => anim.stop();
  }, [width, deadline]);

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: width.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

/**
 * Kahoot-style leaderboard: one glass pill per player (rank, name, this
 * round's +delta, running total), leader crowned. The list lives in the
 * screen's ScrollView, so a 12-player party simply scrolls with the page.
 */
export function Scoreboard({
  rows,
  deltas,
}: {
  /** Players sorted by running score (desc). */
  rows: {userId: string; name: string; score: number}[];
  deltas: Record<string, number>;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.board}>
      {rows.map((row, i) => {
        const d = deltas[row.userId] ?? 0;
        return (
          <GlassCard key={row.userId} radius="pill" style={styles.playerPill}>
            <View style={styles.scoreNameCol}>
              <Text variant="caption" color="muted" style={styles.rank}>
                {i + 1}
              </Text>
              {i === 0 ? (
                <Crown size={14} color={colors.primary} strokeWidth={2} />
              ) : null}
              <Text
                variant="body"
                numberOfLines={1}
                style={i === 0 ? styles.leaderName : undefined}>
                {row.name}
              </Text>
            </View>
            <View style={styles.scoreValueCol}>
              {d !== 0 ? (
                <Text variant="secondary" style={styles.deltaUp}>
                  +{d}
                </Text>
              ) : null}
              <Text
                variant="body"
                style={[styles.points, i === 0 && styles.leaderScore]}>
                {row.score}
              </Text>
            </View>
          </GlassCard>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  // Two per row: half the width minus half the gap.
  cell: {flexBasis: '47%', flexGrow: 1},
  card: {
    minHeight: 92,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  cardPressed: {opacity: 0.7},
  cardName: {color: c.ink},
  track: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: c.divider,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: c.primary,
  },
  board: {gap: spacing.sm},
  playerPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  // Fixed rank column so every name starts at the same x.
  rank: {width: 18},
  points: {fontFamily: fonts.regular, color: c.ink},
  leaderName: {fontFamily: fonts.regular},
  leaderScore: {color: c.primary},
  scoreNameCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1},
  scoreValueCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  deltaUp: {color: c.success},
  });
