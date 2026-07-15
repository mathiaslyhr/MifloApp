import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  __setReduceMotion,
  getReduceMotion,
  useReduceMotion,
} from '../reduceMotion';

/**
 * The contract that matters is the *synchronous* read. Components decide at
 * render time whether to animate at all, and an async answer arrives too late
 * to prevent the animation it was meant to prevent — which is exactly the bug
 * this module replaced.
 */
afterEach(() => __setReduceMotion(false));

test('defaults to motion-on, so an un-primed environment behaves as before', () => {
  expect(getReduceMotion()).toBe(false);
});

test('reads back synchronously', () => {
  __setReduceMotion(true);
  expect(getReduceMotion()).toBe(true);
});

test('the hook re-renders consumers when the OS setting flips', () => {
  const seen: boolean[] = [];
  function Probe() {
    seen.push(useReduceMotion());
    return null;
  }

  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Probe />);
  });
  expect(seen).toEqual([false]);

  ReactTestRenderer.act(() => __setReduceMotion(true));
  expect(seen[seen.length - 1]).toBe(true);

  // Re-publishing the same value must not wake anyone up.
  const before = seen.length;
  ReactTestRenderer.act(() => __setReduceMotion(true));
  expect(seen.length).toBe(before);

  ReactTestRenderer.act(() => __setReduceMotion(false));
  expect(seen[seen.length - 1]).toBe(false);

  // An unmounted consumer must not be notified (nor throw).
  ReactTestRenderer.act(() => tree.unmount());
  const afterUnmount = seen.length;
  ReactTestRenderer.act(() => __setReduceMotion(true));
  expect(seen.length).toBe(afterUnmount);
});

test('the hook hands the first render the already-primed value', () => {
  // Reduce Motion is on BEFORE the component ever mounts, which is the real
  // sequence: the app primes the cache at startup, long before any screen.
  __setReduceMotion(true);
  const seen: boolean[] = [];
  function Probe() {
    seen.push(useReduceMotion());
    return null;
  }
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Probe />);
  });
  // No `false` first — the component never gets a frame it would have animated.
  expect(seen[0]).toBe(true);
  ReactTestRenderer.act(() => tree.unmount());
});
