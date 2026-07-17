/**
 * DailyLeadArt — the lead visual for a daily on the Home card, and the ONE
 * place both "what art each daily shows" and the spoiler rules live:
 *
 *   scout      → a masked player silhouette. The secret footballer IS the
 *                answer, so it is NEVER read here — the silhouette is static.
 *   teamsheet  → a disc in today's kit colour. The club is public (the puzzle
 *                is "name this XI"); only the eleven names are secret, so we
 *                read the kit ONLY (dailyLineupKitFor), never the players.
 *   tenball    → a category emblem from the list's `kind` (a category, not an
 *                answer): club → shield, nation → flag, manager → squad, else a
 *                goal net. The entries' own crests/flags are answers and are
 *                never touched.
 *   journeyman → a static career-route glyph. Nationality + clubs ARE the
 *                progressive clues, so nothing per-puzzle is safe to show.
 *
 * Keep it this way: a future edit that wants richer art must prove, here, that
 * the field it reads is public — the daily card must never leak an answer.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Flag, Goal, Route, Shield, Users, type LucideIcon} from 'lucide-react-native';
import {useColors, useThemedStyles, type Palette} from '../../theme';
import type {DailyGame} from './dailyLog';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {dailyLineupKitFor} from '../../games/teamsheet/dailySeed';
import {dailyListFor} from '../../games/tenball/dailyList';

/** Badge diameter — a touch bigger than a bare line icon so it reads as a token. */
const SIZE = 26;

/** The lucide emblem for a Top Bins list category (spoiler-safe: category, not answer). */
function tenballEmblem(kind: string | undefined): LucideIcon {
  switch (kind) {
    case 'club':
      return Shield;
    case 'nation':
      return Flag;
    case 'manager':
      return Users;
    default:
      // 'player' | 'other' | undefined → a goal net (fits "top scorers" lists).
      return Goal;
  }
}

export function DailyLeadArt({game}: {game: DailyGame}): React.JSX.Element {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dateKey = dateKeyFor(new Date());

  if (game === 'scout') {
    // Head + shoulders of an unknown player, clipped by the badge circle.
    return (
      <View style={styles.badge}>
        <View style={styles.silhouetteHead} />
        <View style={styles.silhouetteBody} />
      </View>
    );
  }

  if (game === 'teamsheet') {
    // The shirt colour itself is the token — the visual Team sheet already uses.
    const body = dailyLineupKitFor(dateKey)?.body ?? colors.primary;
    return <View style={[styles.kit, {backgroundColor: body}]} />;
  }

  if (game === 'tenball') {
    const Emblem = tenballEmblem(dailyListFor(dateKey).kind);
    return (
      <View style={styles.badge}>
        <Emblem size={15} color={colors.textSecondary} strokeWidth={2} />
      </View>
    );
  }

  // journeyman → a static career-route glyph; the secret is never read.
  return (
    <View style={styles.badge}>
      <Route size={15} color={colors.textSecondary} strokeWidth={2} />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // A circular token one rung up from the card surface. The shared shape
    // unifies every daily's lead as a "badge" — closer to a crest than a bare
    // line icon, which is the whole point of the change.
    badge: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      backgroundColor: c.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    // Kit disc: rimmed in a faint light stroke so a near-black kit still reads
    // against the card surface.
    kit: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    silhouetteHead: {
      position: 'absolute',
      top: 5,
      left: (SIZE - 8) / 2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.textTertiary,
    },
    silhouetteBody: {
      position: 'absolute',
      bottom: -6,
      left: (SIZE - 17) / 2,
      width: 17,
      height: 14,
      borderRadius: 8,
      backgroundColor: c.textTertiary,
    },
  });
