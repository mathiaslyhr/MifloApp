/**
 * ToastHost — the app-wide overlay that renders the toast stack. Mounted once at
 * the app root (App.tsx, inside NavigationContainer). Pinned to the top edge,
 * safe-area aware, `pointerEvents="box-none"` so it never blocks the screen
 * beneath it (mirrors the FloatingBar chrome pattern).
 *
 * Cards enter with a soft fade + drop and auto-dismiss on their own timer, then
 * fade out before removing themselves from the store. Honors Reduce Motion →
 * opacity-only (matches usePressScale).
 */
import React, {useEffect, useRef} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, radii, spacing} from '../../../theme';
import {Text} from '../Text';
import {Toast, ToastTone, useToastStore} from './toastStore';

const ENTER_EASING = Easing.bezier(0.34, 1.25, 0.64, 1);
const ENTER_MS = 220;
const EXIT_MS = 160;

/** Left-edge accent per tone. Neutral leans on plain glass. */
const TONE_ACCENT: Record<ToastTone, string> = {
  neutral: colors.primary,
  success: colors.success,
  error: colors.error,
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore(s => s.toasts);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, {paddingTop: insets.top + spacing.sm}]}>
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </View>
  );
}

function ToastCard({toast}: {toast: Toast}) {
  const dismiss = useToastStore(s => s.dismiss);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    let done = false;
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

    const close = () => {
      if (done) {
        return;
      }
      done = true;
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
    };

    const timer = setTimeout(close, toast.duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.card, {opacity, transform: [{translateY}]}]}
      pointerEvents="auto">
      <Pressable
        onPress={() => dismiss(toast.id)}
        accessibilityRole="alert"
        accessibilityLabel={toast.message}
        style={styles.pressable}>
        <View style={[styles.accent, {backgroundColor: TONE_ACCENT[toast.tone]}]} />
        <Text variant="secondary" color="primary" style={styles.message}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    maxWidth: 420,
    width: '92%',
    borderRadius: radii.card,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassRim,
    // Soft lift so the glass reads above the busy rainbow canvas.
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
    overflow: 'hidden',
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: spacing.md,
  },
  message: {flex: 1},
});
