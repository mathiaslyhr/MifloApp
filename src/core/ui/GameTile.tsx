import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {
  Gesture,
  GestureDetector,
  type ScrollView as GHScrollView,
} from 'react-native-gesture-handler';
import {ChevronRight, type LucideIcon} from 'lucide-react-native';
import {
  radii,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {CircleButton} from './CircleButton';
import {PressableScale} from './PressableScale';
import {Text} from './Text';

/** Swipe-reveal geometry: the action column (circle + label) is this wide. */
const ACTION_SIZE = 48;
const REVEAL = 72;
/** The tile can be dragged slightly past the open position, then springs back. */
const OVERDRAG = 16;
/** A flick this fast (px/s) settles the swipe regardless of distance. */
const SWIPE_VELOCITY = 300;
/** The pan activates once the finger moves this far sideways… */
const ACTIVATE_X = 12;
/** …unless it already moved this far vertically, which hands it to the scroll. */
const FAIL_Y = 16;

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
   * "Daily" label rendered as a brand-purple pill (white rim + text) beside the
   * `meta` pill on the tile's top edge — marks the once-a-day puzzle games.
   * Ignored when a `badge` is present, like `meta`.
   */
  daily?: string;
  /**
   * How the trailing `badge` renders:
   * - `'pill'` (default): filled pill with accent text, matching the left
   *   icon badge — for the Games hub tiles.
   * - `'text'`: plain muted label — for the picker popup, where a filled pill
   *   would clash with the glass tiles.
   */
  badgeVariant?: 'pill' | 'text';
  /**
   * Surface treatment:
   * - `'glass'` (default): clear frosted fill for in-flow tiles.
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
  /** Short caption under the revealed circle, e.g. "1 device". */
  secondaryLabel?: string;
  /**
   * Ref to the enclosing gesture-handler ScrollView. The swipe claims priority
   * over it: the scroll waits until the pan fails (finger drifts past FAIL_Y),
   * instead of racing it — without this the scroll view's own recognizer
   * activates first (~10pt of movement in any direction) and the swipe never
   * fires.
   */
  scrollRef?: React.RefObject<GHScrollView | null>;
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
  daily,
  badgeVariant = 'pill',
  surface = 'glass',
  SecondaryIcon,
  onSecondaryPress,
  secondaryAccessibilityLabel,
  secondaryLabel,
  scrollRef,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const hasSwipeAction =
    !!SecondaryIcon && !!onSecondaryPress && !disabled && !badge;

  // Swipe-reveal state. The gesture callbacks read live values through refs
  // (same pattern as the toast pills).
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const startXRef = useRef(0);
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

  // Native-side pan recognition (gesture-handler), so the swipe reliably beats
  // the list's vertical scroll: `blocksExternalGesture(scrollRef)` makes the
  // scroll wait until the pan fails, and the ACTIVATE_X / FAIL_Y corridor
  // decides the finger's intent while tolerating the diagonal drift of a thumb
  // swipe. A leftward pan on a closed tile is harmless — the clamp holds it at
  // 0 — and on an open tile it swipes the reveal shut. Callbacks run on the JS
  // thread (no reanimated), same as the Animated.Value they drive.
  const pan = useMemo(() => {
    const gesture = Gesture.Pan()
      .enabled(hasSwipeAction)
      .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      .onStart(() => {
        startXRef.current = openRef.current ? REVEAL : 0;
      })
      .onUpdate(e => {
        translateX.setValue(
          Math.max(
            0,
            Math.min(REVEAL + OVERDRAG, startXRef.current + e.translationX),
          ),
        );
      })
      .onEnd((e, success) => {
        if (!success) {
          return; // cancelled mid-drag — onFinalize snaps it shut
        }
        const open =
          e.velocityX > SWIPE_VELOCITY
            ? true
            : e.velocityX < -SWIPE_VELOCITY
            ? false
            : startXRef.current + e.translationX > REVEAL / 2;
        settle(open);
      })
      .onFinalize((_e, success) => {
        // Interrupted mid-drag (e.g. by a navigation) — snap shut.
        if (!success) {
          settle(false);
        }
      });
    return scrollRef ? gesture.blocksExternalGesture(scrollRef) : gesture;
  }, [hasSwipeAction, scrollRef, settle, translateX]);
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

  // The `daily` pill rides the same top edge, right after the meta pill: brand
  // purple with a white rim and white text, so the once-a-day games pop.
  const dailyPill =
    daily && !badge ? (
      <View style={[styles.topPillBase, styles.dailyPill]}>
        <Text variant="caption" style={[styles.metaText, styles.dailyText]}>
          {daily}
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
      <View style={styles.topPillRow} pointerEvents="none">
        {topPill}
        {metaPill}
        {dailyPill}
      </View>
      <View style={styles.badge}>
        <Icon size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text variant="section" numberOfLines={1} style={styles.titleText}>
          {title}
        </Text>
        {tagline ? (
          <Text
            variant="secondary"
            color="secondary"
            numberOfLines={1}
            style={styles.taglineText}>
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
            <SecondaryIcon size={20} color={colors.ink} strokeWidth={2} />
          ) : null}
        </CircleButton>
        {secondaryLabel ? (
          <Text
            variant="caption"
            color="secondary"
            numberOfLines={1}
            style={styles.leadingLabel}>
            {secondaryLabel}
          </Text>
        ) : null}
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={{transform: [{translateX}]}}>{tile}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    // "Clear" frosted glass — matches the nav island / secondary button. Flat
    // on purpose: in-flow glass carries no shadow (it smears the background
    // and bleeds into the gaps between stacked tiles).
    backgroundColor: c.glassLight,
    borderColor: c.glassRim,
  },
  // Floating on a dimmed scrim (picker popup): near-solid white + a real lift
  // so the tile reads as its own card with no container behind it.
  cardFloating: {
    backgroundColor: c.glassStrong,
    shadowColor: c.shadowInk,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 12},
    elevation: 8,
  },
  cardDisabled: {opacity: 0.5},
  // Trailing slot (badge or chevron) never shrinks; the body yields space to it.
  trailing: {flexShrink: 0},
  // Swipe-reveal leading action: pinned behind the tile's left edge, vertically
  // centered; the tile slides right over/off it. The column matches REVEAL so
  // the circle + label sit centered in exactly the space the swipe uncovers.
  leadingAction: {
    position: 'absolute',
    left: 0,
    width: REVEAL,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  leadingLabel: {fontSize: 11, lineHeight: 13},
  // Top-edge pill row straddling the tile's top border (like the lobby host
  // badge). Left-anchored to line up with the title text below it: card
  // padding + icon badge (44) + gap. The trailing-status `topPill` and the
  // ambient `metaPill` are mutually exclusive; the `dailyPill` sits beside the
  // meta pill when both are present.
  topPillRow: {
    position: 'absolute',
    top: -13,
    left: spacing.lg + 44 + spacing.md,
    right: spacing.lg,
    zIndex: 2,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  topPillBase: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: c.surface2,
    borderWidth: 1,
    borderColor: c.glassRim,
    shadowColor: c.shadowInk,
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 3},
    shadowRadius: 6,
    elevation: 3,
  },
  // The "Daily" variant: brand purple, white rim, white text.
  dailyPill: {backgroundColor: c.primary, borderColor: c.onInk},
  dailyText: {color: c.onInk},
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
  // One step under the section/secondary scale so full taglines fit one line.
  titleText: {flexShrink: 1, fontSize: 16, lineHeight: 20},
  taglineText: {fontSize: 13, lineHeight: 17},
});
