import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {
  Gesture,
  GestureDetector,
  type ScrollView as GHScrollView,
} from 'react-native-gesture-handler';
import type {LucideIcon} from 'lucide-react-native';
import {colors, spacing} from '../../theme';
import {CircleButton} from './CircleButton';
import {Text} from './Text';

// Same swipe-reveal geometry as GameTile's leading action, extracted for
// arbitrary rows (friend cards use it for remove).
const ACTION_SIZE = 48;
const REVEAL = 72;
const OVERDRAG = 16;
const SWIPE_VELOCITY = 300;
const ACTIVATE_X = 12;
const FAIL_Y = 16;

// One reveal open at a time, app-wide (the Mail model): the open row parks
// its closer here; the next row's drag start, or a scroll via
// closeOpenSwipeReveal, snaps it shut.
let closeCurrent: (() => void) | null = null;

/** Close whichever SwipeReveal row is open (call from onScrollBeginDrag). */
export function closeOpenSwipeReveal() {
  closeCurrent?.();
}

type Props = {
  /** The row content; slides right to uncover the action. */
  children: React.ReactNode;
  Icon: LucideIcon;
  /** Short caption under the circle, e.g. "Remove". */
  label?: string;
  /** Red icon + label for destructive actions. */
  destructive?: boolean;
  onAction: () => void;
  actionAccessibilityLabel: string;
  enabled?: boolean;
  /**
   * Ref to the enclosing gesture-handler ScrollView; the pan claims priority
   * over it (see GameTile — without this the scroll recognizer wins and the
   * swipe never fires).
   */
  scrollRef?: React.RefObject<GHScrollView | null>;
};

/**
 * Mail-style swipe-right reveal: the child row slides over and a hidden
 * circle action (plus caption) fades in on the left. Tapping the action fires
 * `onAction`; tapping the row while open just closes it; interrupted drags
 * snap shut. Never place inside an `overflow: hidden` ancestor — the clip
 * cuts the slide off and the whole gesture reads stiff.
 */
export function SwipeReveal({
  children,
  Icon,
  label,
  destructive = false,
  onAction,
  actionAccessibilityLabel,
  enabled = true,
  scrollRef,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const startXRef = useRef(0);
  // Mirrors the drag for render: gates the action's tappability. Flipped
  // mid-drag (past halfway) so the action works as soon as it's visible,
  // not only after the release spring settles.
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const closeSelfRef = useRef<(() => void) | null>(null);

  const setRevealedNow = useCallback((open: boolean) => {
    if (revealedRef.current !== open) {
      revealedRef.current = open;
      setRevealed(open);
    }
  }, []);

  const settle = useCallback(
    (open: boolean) => {
      openRef.current = open;
      setRevealedNow(open);
      // Single-open bookkeeping: claim the slot when opening, release it
      // when this row was the one holding it.
      if (open) {
        closeCurrent = closeSelfRef.current;
      } else if (closeCurrent === closeSelfRef.current) {
        closeCurrent = null;
      }
      Animated.spring(translateX, {
        toValue: open ? REVEAL : 0,
        speed: 20,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
    },
    [setRevealedNow, translateX],
  );

  useEffect(() => {
    const close = () => settle(false);
    closeSelfRef.current = close;
    return () => {
      // Unmounting while open must not leave a dangling closer behind.
      if (closeCurrent === close) {
        closeCurrent = null;
      }
    };
  }, [settle]);

  const pan = useMemo(() => {
    const gesture = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      .onStart(() => {
        // Starting a drag here closes whichever other row is open.
        if (closeCurrent && closeCurrent !== closeSelfRef.current) {
          closeCurrent();
        }
        startXRef.current = openRef.current ? REVEAL : 0;
      })
      .onUpdate(e => {
        const next = Math.max(
          0,
          Math.min(REVEAL + OVERDRAG, startXRef.current + e.translationX),
        );
        translateX.setValue(next);
        setRevealedNow(next > REVEAL / 2);
      })
      .onEnd((e, success) => {
        if (!success) {
          return;
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
        if (!success) {
          settle(false);
        }
      });
    return scrollRef ? gesture.blocksExternalGesture(scrollRef) : gesture;
  }, [enabled, scrollRef, setRevealedNow, settle, translateX]);

  const tint = destructive ? colors.error : colors.ink;

  return (
    <View>
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
          accessibilityLabel={actionAccessibilityLabel}
          onPress={() => {
            settle(false);
            onAction();
          }}>
          <Icon size={20} color={tint} strokeWidth={2} />
        </CircleButton>
        {label ? (
          <Text
            variant="caption"
            numberOfLines={1}
            style={[styles.leadingLabel, {color: tint}]}>
            {label}
          </Text>
        ) : null}
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={{transform: [{translateX}]}}>
          {children}
          {revealed ? (
            // A tap on a swiped-open row just closes it, Mail style, instead
            // of firing the row's own press (GameTile does the same check in
            // its onPress; here the child owns its press, so we cover it).
            <Pressable
              style={StyleSheet.absoluteFill}
              accessible={false}
              onPress={() => settle(false)}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
