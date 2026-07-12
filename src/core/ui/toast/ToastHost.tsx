/**
 * ToastHost — the app-wide overlay that renders the toast stack. Mounted once at
 * the app root (App.tsx, inside SafeAreaProvider as UpdateGate's sibling, so
 * toasts also overlay the update wall). Pinned to the top edge,
 * safe-area aware, `pointerEvents="box-none"` so it never blocks the screen
 * beneath it (mirrors the FloatingBar chrome pattern).
 *
 * Pills enter with a soft fade + drop and auto-dismiss on their own timer.
 * They stack iOS-notification style: the newest sits in front and older ones
 * tuck behind it, peeking out just enough to show there's more. With one pill,
 * tap dismisses it; with 2+, tap expands the stack into a readable list (all
 * timers pause) where each pill can be tapped or swiped away on its own — the
 * stack collapses by itself once one pill is left. Swiping sideways flings the
 * pill off (a quick flick counts before the distance threshold; the timer
 * pauses while a finger is down). Honors Reduce Motion → opacity-only
 * (matches usePressScale).
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {Check, Info, X} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  radii,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../../theme';
import {Text} from '../Text';
import {Toast, ToastTone, useToastStore} from './toastStore';

const ENTER_EASING = Easing.bezier(0.34, 1.25, 0.64, 1);
const EXIT_EASING = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER_MS = 220;
const EXIT_MS = 160;
const CHIP_SIZE = 24;
const CHIP_ICON = 14;

/** Stack geometry: each older pill peeks this much above the one in front. */
const PEEK = 8;
/** …and shrinks this much per step back, selling the depth. */
const DEPTH_SCALE = 0.05;

/** Swipe-to-dismiss: past this distance, or on a quick flick, the pill goes. */
const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 0.3;

/**
 * Leading icon chip per tone: a lucide glyph in a soft tinted circle, so the
 * meaning reads without color (and without relying on red/green alone).
 */
const toneChip = (
  c: Palette,
): Record<ToastTone, {Icon: typeof Info; color: string; tint: string}> => ({
  neutral: {Icon: Info, color: c.primary, tint: c.toastTintNeutral},
  success: {Icon: Check, color: c.success, tint: c.toastTintSuccess},
  error: {Icon: X, color: c.error, tint: c.toastTintError},
});

const EXPAND_ANIM = LayoutAnimation.create(
  ENTER_MS,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const toasts = useToastStore(s => s.toasts);
  const [expanded, setExpanded] = useState(false);
  // The front pill's measured height — pills behind are clamped to it so a
  // taller old message never pokes out under a shorter new one.
  const [frontHeight, setFrontHeight] = useState(0);

  const expand = useCallback(() => {
    LayoutAnimation.configureNext(EXPAND_ANIM);
    setExpanded(true);
  }, []);

  const collapse = useCallback(() => {
    LayoutAnimation.configureNext(EXPAND_ANIM);
    setExpanded(false);
  }, []);

  // The stack collapses on its own once it's down to a single pill.
  useEffect(() => {
    if (expanded && toasts.length <= 1) {
      LayoutAnimation.configureNext(EXPAND_ANIM);
      setExpanded(false);
    }
  }, [expanded, toasts.length]);

  // Newest first: index 0 is the front pill (and the top row when expanded).
  const ordered = [...toasts].reverse();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {paddingTop: insets.top + spacing.sm},
        // While expanded the host covers the screen so the backdrop below can
        // catch a tap anywhere; collapsed it hugs the pills (box-none keeps
        // the app tappable through it either way).
        expanded && styles.hostExpanded,
      ]}>
      {expanded ? (
        // Invisible tap-catcher behind the pills: touch anything that isn't a
        // toast and the stack folds back up (timers resume and drain it).
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={collapse}
          accessible={false}
        />
      ) : null}
      <View pointerEvents="box-none" style={styles.stack}>
        {ordered.map((t, depth) => (
          <ToastCard
            key={t.id}
            toast={t}
            depth={depth}
            expanded={expanded}
            canExpand={!expanded && ordered.length > 1}
            onExpand={expand}
            frontHeight={frontHeight}
            onFrontHeight={setFrontHeight}
          />
        ))}
      </View>
    </View>
  );
}

type CardProps = {
  toast: Toast;
  /** 0 = front (newest); 1, 2 tuck progressively further behind. */
  depth: number;
  /** Whole-stack state: expanded pills lay out as a readable list. */
  expanded: boolean;
  /** True when a tap should fan the stack out instead of dismissing. */
  canExpand: boolean;
  onExpand: () => void;
  frontHeight: number;
  onFrontHeight: (height: number) => void;
};

function ToastCard({
  toast,
  depth,
  expanded,
  canExpand,
  onExpand,
  frontHeight,
  onFrontHeight,
}: CardProps) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dismiss = useToastStore(s => s.dismiss);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const stack = useRef(new Animated.Value(depth)).current;
  const reduceMotion = useRef(false);
  const leavingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFront = depth === 0;
  // The pan responder is created once, so it reads live state through refs.
  const isFrontRef = useRef(isFront);
  isFrontRef.current = isFront;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    clearTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: reduceMotion.current ? 0 : -8,
        duration: EXIT_MS,
        useNativeDriver: true,
      }),
    ]).start(() => dismiss(toast.id));
  }, [clearTimer, dismiss, opacity, translateY, toast.id]);

  /** Carry the pill off in the swipe direction, then remove it. */
  const flingOut = useCallback(
    (direction: number) => {
      if (leavingRef.current) {
        return;
      }
      leavingRef.current = true;
      clearTimer();
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: direction * 480,
          duration: reduceMotion.current ? 0 : 200,
          easing: EXIT_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          easing: EXIT_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => dismiss(toast.id));
    },
    [clearTimer, dismiss, opacity, translateX, toast.id],
  );

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(close, toast.duration);
  }, [clearTimer, close, toast.duration]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => {
        reduceMotion.current = v;
      })
      .catch(() => {});

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: ENTER_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: reduceMotion.current ? 0 : ENTER_MS,
        easing: ENTER_EASING,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss runs only while the stack is collapsed — an expanded stack
  // is being read, so every pill waits for the user.
  useEffect(() => {
    if (leavingRef.current) {
      return;
    }
    if (expanded) {
      clearTimer();
      return;
    }
    startTimer();
    return clearTimer;
  }, [expanded, startTimer, clearTimer]);

  // Slide into the new stack slot whenever a pill in front arrives or leaves;
  // expanding flattens every pill back to its natural size and place.
  useEffect(() => {
    Animated.timing(stack, {
      toValue: expanded ? 0 : depth,
      duration: reduceMotion.current ? 0 : ENTER_MS,
      easing: EXIT_EASING,
      useNativeDriver: true,
    }).start();
  }, [depth, expanded, stack]);

  // Horizontal swipe. Claimed in the capture phase (the inner Pressable would
  // otherwise hold the gesture), but only once the finger clearly moves
  // sideways, so plain taps still reach the Pressable.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        (isFrontRef.current || expandedRef.current) &&
        !leavingRef.current &&
        Math.abs(g.dx) > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        // Hold the auto-dismiss while a finger is on the pill.
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      },
      onPanResponderMove: (_, g) => translateX.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > SWIPE_DISTANCE || Math.abs(g.vx) > SWIPE_VELOCITY) {
          flingOut(g.dx >= 0 ? 1 : -1);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            speed: 20,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
          if (!expandedRef.current) {
            startTimer();
          }
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          speed: 20,
          bounciness: 5,
          useNativeDriver: true,
        }).start();
        if (!expandedRef.current) {
          startTimer();
        }
      },
    }),
  ).current;

  const {Icon, color, tint} = toneChip(colors)[toast.tone];

  const stackTranslateY = stack.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -PEEK, -PEEK * 2],
    extrapolate: 'clamp',
  });
  const stackScale = stack.interpolate({
    inputRange: [0, 2],
    outputRange: [1, 1 - DEPTH_SCALE * 2],
    extrapolate: 'clamp',
  });

  const behind = !expanded && !isFront;

  return (
    <Animated.View
      {...pan.panHandlers}
      pointerEvents={expanded || isFront ? 'auto' : 'none'}
      onLayout={
        !expanded && isFront
          ? e => onFrontHeight(e.nativeEvent.layout.height)
          : undefined
      }
      style={[
        styles.card,
        behind && styles.behind,
        behind && frontHeight > 0 && {height: frontHeight},
        {
          zIndex: 100 - depth,
          opacity,
          transform: [
            {translateY: Animated.add(translateY, stackTranslateY)},
            {translateX},
            {scale: stackScale},
          ],
        },
      ]}>
      <Pressable
        onPress={canExpand ? onExpand : close}
        accessibilityRole="alert"
        accessibilityLabel={toast.message}
        style={styles.pressable}>
        <View style={[styles.chip, {backgroundColor: tint}]}>
          <Icon size={CHIP_ICON} color={color} strokeWidth={2.5} />
        </View>
        <Text variant="caption" color="muted" style={styles.message}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hostExpanded: {
    bottom: 0,
  },
  // Overlap container: the front pill lays out normally and gives it height;
  // older pills stack absolutely behind it (or flow as a list when expanded).
  stack: {
    width: '92%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  card: {
    width: '100%',
    // Fully round — toasts speak the same pill language as buttons and tags.
    borderRadius: radii.pill,
    // Fully solid white: pills overlap in the stack and float over busy
    // content, so nothing may ghost through.
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassRim,
    // Soft lift so the glass reads above the busy rainbow canvas.
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
    overflow: 'hidden',
  },
  behind: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
  },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  message: {flex: 1},
  });
