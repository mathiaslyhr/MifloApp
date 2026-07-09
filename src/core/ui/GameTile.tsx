import React, {useCallback, useRef, useState} from 'react';
import {Animated, PanResponder, StyleSheet, View} from 'react-native';
import {ChevronRight, type LucideIcon} from 'lucide-react-native';
import {colors, radii, spacing} from '../../theme';
import {CircleButton} from './CircleButton';
import {PressableScale} from './PressableScale';
import {Text} from './Text';

/** Swipe-reveal geometry: circle button diameter + breathing room each side. */
const ACTION_SIZE = 40;
const REVEAL = ACTION_SIZE + spacing.sm * 2;
/** The tile can be dragged slightly past the open position, then springs back. */
const OVERDRAG = 16;
/** A flick this fast settles the swipe regardless of distance. */
const SWIPE_VELOCITY = 0.3;

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
  /**
   * Optional hidden leading action, Apple Mail style: swiping the tile to the
   * right slides it over and reveals a small circle button on the left (e.g.
   * "play on one phone" on games that support pass-and-play). Tapping the tile
   * stays the primary action; while revealed, a tile tap just closes the swipe.
   */
  SecondaryIcon?: LucideIcon;
  onSecondaryPress?: () => void;
  secondaryAccessibilityLabel?: string;
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
  SecondaryIcon,
  onSecondaryPress,
  secondaryAccessibilityLabel,
}: Props) {
  const hasSwipeAction =
    !!SecondaryIcon && !!onSecondaryPress && !disabled && !badge;

  // Swipe-reveal state. The pan responder is created once, so it reads live
  // values through refs (same pattern as the toast pills).
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const startXRef = useRef(0);
  const swipeEnabledRef = useRef(hasSwipeAction);
  swipeEnabledRef.current = hasSwipeAction;
  // Mirrors openRef for render: gates the action's tappability.
  const [revealed, setRevealed] = useState(false);

  const settle = useCallback(
    (open: boolean) => {
      openRef.current = open;
      setRevealed(open);
      Animated.spring(translateX, {
        toValue: open ? REVEAL : 0,
        speed: 20,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
    },
    [translateX],
  );

  // Claimed in the capture phase (the PressableScale would otherwise hold the
  // gesture), but only once the finger clearly moves sideways, so plain taps
  // and vertical list scrolling are untouched.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        swipeEnabledRef.current &&
        Math.abs(g.dx) > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy) &&
        (g.dx > 0 || openRef.current),
      onPanResponderGrant: () => {
        startXRef.current = openRef.current ? REVEAL : 0;
      },
      onPanResponderMove: (_, g) => {
        translateX.setValue(
          Math.max(0, Math.min(REVEAL + OVERDRAG, startXRef.current + g.dx)),
        );
      },
      onPanResponderRelease: (_, g) => {
        const open =
          g.vx > SWIPE_VELOCITY
            ? true
            : g.vx < -SWIPE_VELOCITY
            ? false
            : startXRef.current + g.dx > REVEAL / 2;
        settle(open);
      },
      onPanResponderTerminate: () => settle(false),
    }),
  ).current;
  // `'pill'` badge sits on the top edge (like the lobby host badge) so it never
  // steals row width from the name/tagline.
  const topPill =
    badge && badgeVariant === 'pill' ? (
      <View style={styles.topPillBase}>
        <Text variant="caption" color="accent" style={styles.pillText}>
          {badge}
        </Text>
      </View>
    ) : null;

  // The audience `meta` pill straddles the tile's top edge (like the lobby host
  // badge that sits on a player tag's top border), left-anchored over the title
  // inset — rather than living inline in the title row or the trailing slot.
  const metaPill =
    meta && !badge ? (
      <View style={styles.topPillBase}>
        <Text variant="caption" color="secondary" style={styles.metaText}>
          {meta}
        </Text>
      </View>
    ) : null;

  // Trailing slot: a `'text'` badge, else the chevron on a tappable tile.
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
  } else if (!disabled && !badge) {
    trailing = (
      <ChevronRight size={22} color={colors.textTertiary} strokeWidth={2} />
    );
  }

  const tile = (
    <PressableScale
      onPress={
        disabled
          ? undefined
          : () => {
              // A tap on a swiped-open tile just closes it, Mail style.
              if (openRef.current) {
                settle(false);
                return;
              }
              onPress?.();
            }
      }
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
      {metaPill}
      <View style={styles.badge}>
        <Icon size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text variant="section" numberOfLines={1} style={styles.titleText}>
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

  if (!hasSwipeAction) {
    return tile;
  }

  return (
    <View>
      {/* The hidden leading action. It fades in with the swipe — the tile's
          glass is translucent, so at rest it must be fully invisible. */}
      <Animated.View
        pointerEvents={revealed ? 'auto' : 'none'}
        style={[
          styles.leadingAction,
          {
            opacity: translateX.interpolate({
              inputRange: [0, REVEAL],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}>
        <CircleButton
          size={ACTION_SIZE}
          accessibilityLabel={secondaryAccessibilityLabel ?? ''}
          onPress={() => {
            settle(false);
            onSecondaryPress?.();
          }}>
          {SecondaryIcon ? (
            <SecondaryIcon size={18} color={colors.ink} strokeWidth={2} />
          ) : null}
        </CircleButton>
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{transform: [{translateX}]}}>
        {tile}
      </Animated.View>
    </View>
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
  // Swipe-reveal leading action: pinned behind the tile's left edge, vertically
  // centered; the tile slides right over/off it.
  leadingAction: {
    position: 'absolute',
    left: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // Shared top-edge pill: an off-white chip straddling the tile's top border
  // (like the lobby host badge). Left-anchored to line up with the title text
  // below it: card padding + icon badge (44) + gap. Both the trailing-status
  // `topPill` and the ambient `metaPill` ride here — they're mutually exclusive,
  // so they share one slot and differ only in their text color.
  topPillBase: {
    position: 'absolute',
    top: -13,
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
  metaText: {fontSize: 11, lineHeight: 14, letterSpacing: 0.3},
  // Plain muted label (picker popup) — no background to clash with glass tiles.
  textBadge: {fontSize: 12, lineHeight: 15},
  badge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card - 4,
  },
  body: {flex: 1, gap: 2},
  titleText: {flexShrink: 1},
});
