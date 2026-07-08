import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChevronRight, type LucideIcon} from 'lucide-react-native';
import {colors, radii, spacing} from '../../theme';
import {PressableScale} from './PressableScale';
import {Text} from './Text';

type Props = {
  title: string;
  tagline?: string;
  Icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Dim the tile and ignore taps (e.g. a game that isn't built yet). */
  disabled?: boolean;
  /** Trailing status label, e.g. "Coming soon". Shown in place of the chevron. */
  badge?: string;
  /**
   * Ambient metadata rendered as a small muted pill in the trailing slot, e.g.
   * an audience label ("Solo" / "1v1" / "3+") on the Games hub. Takes the
   * chevron's place; ignored when a `badge` is present.
   */
  meta?: string;
  /**
   * How the trailing `badge` renders:
   * - `'pill'` (default): off-white pill with purple text, matching the left
   *   icon badge — for the glassy Games hub on the rainbow canvas.
   * - `'text'`: plain muted label — for the picker popup, where a filled pill
   *   would clash with the glass tiles.
   */
  badgeVariant?: 'pill' | 'text';
  /**
   * Surface treatment:
   * - `'glass'` (default): clear frosted fill for the rainbow canvas.
   * - `'floating'`: near-solid frosted white for a tile floating on a dimmed
   *   (dark) scrim — e.g. the game-picker popup, which has no card behind it.
   */
  surface?: 'glass' | 'floating';
};

/**
 * A full-width glass card for the Games hub: an accent icon badge, the game
 * title + a one-line tagline, and a trailing chevron. Reuses the "clear"
 * frosted-glass language (glassLight fill, glassRim rim, soft lift shadow) from
 * CircleButton / IslandTabBar, and the shared springy press-scale via
 * PressableScale.
 */
export function GameTile({
  title,
  tagline,
  Icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  badge,
  meta,
  badgeVariant = 'pill',
  surface = 'glass',
}: Props) {
  // `'pill'` badge sits on the top edge (like the lobby host badge) so it never
  // steals row width from the name/tagline.
  const topPill =
    badge && badgeVariant === 'pill' ? (
      <View style={styles.topPill}>
        <Text variant="caption" color="accent" style={styles.pillText}>
          {badge}
        </Text>
      </View>
    ) : null;

  // Trailing slot, in priority: a `'text'` badge, then a muted `meta` pill (e.g.
  // audience label), then the chevron on a tappable tile.
  let trailing: React.ReactNode = null;
  if (badge && badgeVariant === 'text') {
    trailing = (
      <Text
        variant="caption"
        color="secondary"
        numberOfLines={1}
        style={styles.textBadge}>
        {badge}
      </Text>
    );
  } else if (meta && !badge) {
    trailing = (
      <View style={styles.metaPill}>
        <Text variant="caption" color="secondary" style={styles.metaText}>
          {meta}
        </Text>
      </View>
    );
  } else if (!disabled && !badge) {
    trailing = (
      <ChevronRight size={22} color={colors.textTertiary} strokeWidth={2} />
    );
  }

  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={disabled ? {disabled: true} : undefined}
      style={[
        styles.card,
        surface === 'floating' && styles.cardFloating,
        disabled && styles.cardDisabled,
      ]}>
      {topPill}
      <View style={styles.badge}>
        <Icon size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text variant="section" numberOfLines={1}>
          {title}
        </Text>
        {tagline ? (
          <Text variant="secondary" color="secondary" numberOfLines={1}>
            {tagline}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    // "Clear" frosted glass — matches the nav island / secondary button. Flat
    // on purpose: in-flow glass carries no shadow (it smears the pastel mesh
    // and bleeds into the gaps between stacked tiles).
    backgroundColor: colors.glassLight,
    borderColor: colors.glassRim,
  },
  // Floating on a dimmed scrim (picker popup): near-solid white + a real lift
  // so the tile reads as its own card with no container behind it.
  cardFloating: {
    backgroundColor: colors.glassStrong,
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 12},
    elevation: 8,
  },
  cardDisabled: {opacity: 0.5},
  // Trailing slot (badge or chevron) never shrinks; the body yields space to it.
  trailing: {flexShrink: 0},
  // Off-white pill with purple text, straddling the tile's top edge (like the
  // lobby host badge). Left-anchored to line up with the title text below it:
  // card padding + icon badge (44) + gap.
  topPill: {
    position: 'absolute',
    top: -9,
    left: spacing.lg + 44 + spacing.md,
    zIndex: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.glassRim,
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 3},
    shadowRadius: 6,
    elevation: 3,
  },
  pillText: {fontSize: 11, lineHeight: 14, letterSpacing: 0.3},
  // Ambient audience chip in the trailing slot — off-white pill matching the
  // icon badge tone, muted text (metadata, not a call-to-action).
  metaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  metaText: {fontSize: 11, lineHeight: 14, letterSpacing: 0.3},
  // Plain muted label (picker popup) — no background to clash with glass tiles.
  textBadge: {fontSize: 12, lineHeight: 15},
  badge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card - 4,
    backgroundColor: colors.surface2,
  },
  body: {flex: 1, gap: 2},
});
