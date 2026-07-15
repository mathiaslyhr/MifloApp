/**
 * App-wide Reduce Motion state.
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` is an async native round trip, so
 * a component that asks at mount has no answer on its first frame — it would
 * animate once before finding out, which is exactly the thing Reduce Motion
 * exists to prevent. So the value is cached at module scope and primed once at
 * app start: by the time any screen mounts (the boot splash alone runs ~1.8s)
 * the read is synchronous and correct.
 *
 * One native query for the whole app, too. Before this, every `PressableScale`
 * fired its own round trip and registered its own listener on mount — dozens
 * per screen.
 *
 * Two consumers, two shapes:
 *   getReduceMotion()  — imperative, for callbacks that must not re-render
 *                        (usePressScale runs on every press, on every control).
 *   useReduceMotion()  — reactive, for components that must decide at RENDER
 *                        time whether to animate at all (Skeleton, the badge).
 *
 * The default is `false` (motion on), which is the pre-existing behavior, so an
 * un-primed environment — a unit test rendering a component in isolation —
 * behaves exactly as it did before.
 */
import {useEffect, useSyncExternalStore} from 'react';
import {AccessibilityInfo} from 'react-native';

let enabled = false;
let primed = false;
const listeners = new Set<() => void>();

function publish(value: boolean) {
  if (value === enabled) {
    return;
  }
  enabled = value;
  listeners.forEach(l => l());
}

/** Synchronous read. Valid from app start; `false` until primed. */
export function getReduceMotion(): boolean {
  return enabled;
}

/**
 * Prime the cache and subscribe to OS changes. Idempotent. Called from App's
 * init effect; `useReduceMotion` self-primes as a fallback, so this is an
 * optimization rather than a correctness requirement.
 *
 * The OS listener is never removed: its lifetime is the app's.
 */
export function initReduceMotion(): void {
  if (primed) {
    return;
  }
  primed = true;
  AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
  AccessibilityInfo.isReduceMotionEnabled()
    .then(publish)
    .catch(() => {});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Re-renders on change. Sync and correct on the first frame once primed. */
export function useReduceMotion(): boolean {
  useEffect(() => {
    initReduceMotion();
  }, []);
  // getSnapshot returns a primitive, so there's no new-object-per-call loop.
  return useSyncExternalStore(subscribe, getReduceMotion);
}

/** @internal Test seam. */
export function __setReduceMotion(value: boolean): void {
  primed = true;
  publish(value);
}
