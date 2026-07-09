import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Skeleton} from '../Skeleton';

// The pulse runs on an Animated.loop; fake timers keep it from holding the
// test's task queue open.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('renders a sized, labelled placeholder block', () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <Skeleton width={120} height={20} accessibilityLabel="loading" />,
    );
  });

  const json = tree.toJSON() as unknown as {
    props: {style: unknown; accessibilityLabel: string};
  };
  expect(json.props.accessibilityLabel).toBe('loading');
  const style = flatten(json.props.style);
  expect(style.width).toBe(120);
  expect(style.height).toBe(20);

  ReactTestRenderer.act(() => tree.unmount());
});

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign(
    {},
    ...(Array.isArray(style) ? (style.flat(3) as object[]) : [style as object]),
  );
}
