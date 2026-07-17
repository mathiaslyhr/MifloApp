/**
 * DailyLeadArt — the lead badge for a daily on the Home card, and the ONE place
 * both "what each daily shows" and the spoiler rules live. Every lead is a real,
 * per-day fact chosen so it can never give the answer away:
 *
 *   scout      → a signal-strength glyph = how big a name today's mystery is
 *                (fame tier). Touches none of Scout's five guess columns.
 *   teamsheet  → the club crest, or the nation's flag. The team is announced
 *                in-game; only the eleven names are secret. Kit colour is the
 *                fallback when no crest/flag is bundled.
 *   tenball    → the metric the list ranks by (goals → ball, assists → foot,
 *                titles → trophy…). A metric is never one of the answers.
 *   journeyman → today's number of career clubs (3+). Non-identifying, and the
 *                game reveals the clubs anyway.
 *
 * Keep it this way: a future edit must prove the fact it reads is public or
 * non-identifying, here, in one place.
 */
import React from 'react';
import {Image, StyleSheet, Text, View, type ImageSourcePropType} from 'react-native';
import {
  BadgeEuro,
  Footprints,
  MapPin,
  Medal,
  Route,
  Shirt,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Trophy,
  Volleyball,
  type LucideIcon,
} from 'lucide-react-native';
import {fonts, useColors, useThemedStyles, type Palette} from '../../theme';
import type {DailyGame} from './dailyLog';
import {dateKeyFor, dailyScoutFameTier} from '../../games/scout/dailySeed';
import {dailyLineupKitFor, dailyLineupTeamFor} from '../../games/teamsheet/dailySeed';
import {teamArt} from '../../games/teamsheet/teamArt';
import {dailyListFor} from '../../games/tenball/dailyList';
import {listMetric, type TenballMetric} from '../../games/tenball/metric';
import {dailyJourneymanClubCountFor} from '../../games/journeyman/dailySeed';

/** Badge diameter — a touch bigger than a bare line icon so it reads as a token. */
const SIZE = 26;

const FAME_ICON = {low: SignalLow, mid: SignalMedium, high: SignalHigh} as const;

const METRIC_ICON: Record<TenballMetric, LucideIcon> = {
  goals: Volleyball, // the ball, matching Team sheet's goal clue
  assists: Footprints, // the boot, matching Team sheet's assist clue
  apps: Shirt,
  titles: Trophy,
  awards: Medal,
  transfers: BadgeEuro,
  venue: MapPin,
};

export function DailyLeadArt({game}: {game: DailyGame}): React.JSX.Element {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dateKey = dateKeyFor(new Date());

  if (game === 'scout') {
    const Icon = FAME_ICON[dailyScoutFameTier(dateKey)];
    return <Badge Icon={Icon} styles={styles} color={colors.textSecondary} />;
  }

  if (game === 'teamsheet') {
    const art = teamArt(dailyLineupTeamFor(dateKey));
    if (art?.kind === 'crest') {
      return <ArtBadge source={art.source} shape="crest" styles={styles} />;
    }
    if (art?.kind === 'flag') {
      return <ArtBadge source={art.source} shape="flag" styles={styles} />;
    }
    // No bundled crest/flag → the kit colour, as a plain disc.
    const body = dailyLineupKitFor(dateKey)?.body ?? colors.primary;
    return <View style={[styles.kit, {backgroundColor: body}]} />;
  }

  if (game === 'tenball') {
    const Icon = METRIC_ICON[listMetric(dailyListFor(dateKey))];
    return <Badge Icon={Icon} styles={styles} color={colors.textSecondary} />;
  }

  // journeyman → the number of clubs today's career spans.
  return (
    <View style={styles.badge}>
      <Text style={styles.count}>{dailyJourneymanClubCountFor(dateKey)}</Text>
      <Route size={9} color={colors.textTertiary} strokeWidth={2} style={styles.countGlyph} />
    </View>
  );
}

function Badge({
  Icon,
  color,
  styles,
}: {
  Icon: LucideIcon;
  color: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.badge}>
      <Icon size={15} color={color} strokeWidth={2} />
    </View>
  );
}

function ArtBadge({
  source,
  shape,
  styles,
}: {
  source: ImageSourcePropType;
  shape: 'crest' | 'flag';
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={shape === 'flag' ? styles.flag : styles.crest}>
      <Image
        source={source}
        resizeMode={shape === 'flag' ? 'cover' : 'contain'}
        style={shape === 'flag' ? styles.flagImg : styles.crestImg}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // A circular token one rung up from the card surface. The shared shape
    // unifies every daily's lead as a "badge", closer to a crest than a bare
    // line icon — which is the whole point of the change.
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
    // Journeyman: the club count reads as the token; a tiny route glyph under it
    // says "journey", not "rank".
    count: {
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 15,
      color: c.ink,
      fontVariant: ['tabular-nums'],
    },
    countGlyph: {marginTop: -1},
    // Crest: contained in a rounded-square token (crests carry their own
    // transparent padding); flag: cover-cropped into a round nation roundel.
    crest: {
      width: SIZE,
      height: SIZE,
      borderRadius: 7,
      backgroundColor: c.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 3,
    },
    crestImg: {width: '100%', height: '100%'},
    flag: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
    },
    flagImg: {width: '100%', height: '100%'},
    // Kit fallback: rimmed so a near-black kit still reads on the card surface.
    kit: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.14)',
    },
  });
