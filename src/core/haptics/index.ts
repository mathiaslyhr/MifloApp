/**
 * Haptics — a thin, crash-proof wrapper over `react-native-haptic-feedback`.
 *
 * Every call is a no-op when the native module is missing (e.g. a JS-only test
 * run, or before the pod is linked) or when the user has turned haptics off in
 * Settings, so call sites never need to guard. Semantic verbs map to the crisp
 * iOS impact / notification generators.
 */
import type {HapticFeedbackTypes} from 'react-native-haptic-feedback';

// Load lazily/defensively: a bare require means a missing native module (or a
// jest run without the mock) degrades to no-ops instead of throwing at import.
let engine: {
  trigger: (type: HapticFeedbackTypes | string, options?: object) => void;
} | null = null;
try {
  engine = require('react-native-haptic-feedback').default ?? null;
} catch {
  engine = null;
}

/** iOS: don't fall back to a coarse vibration when a generator is unavailable. */
const OPTIONS = {enableVibrateFallback: false, ignoreAndroidSystemSettings: false};

// User preference (Settings › reduce haptics). Defaults on; persisted by the
// settings layer, which calls `setHapticsEnabled` on boot and on toggle.
let enabled = true;

/** Toggle all haptics on/off (wired to the Settings preference). */
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function areHapticsEnabled() {
  return enabled;
}

function fire(type: HapticFeedbackTypes | string) {
  if (!enabled || !engine) {
    return;
  }
  try {
    engine.trigger(type, OPTIONS);
  } catch {
    // Never let feedback break a user action.
  }
}

export const haptics = {
  /** Light tap — button presses, selections, skips. */
  tap: () => fire('impactLight'),
  /** Medium thud — a committed action (submit, propose). */
  press: () => fire('impactMedium'),
  /** Positive resolution — a correct pick, a saved form. */
  success: () => fire('notificationSuccess'),
  /** Soft caution — a no-op or gentle rejection. */
  warning: () => fire('notificationWarning'),
  /** Negative — a wrong pick, a failed action. */
  error: () => fire('notificationError'),
};
