import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Segmented} from '../Segmented';
import {PressableScale} from '../PressableScale';
import {SkinProvider} from '../../../theme';

/**
 * The thumb's arithmetic is covered in segmentedThumb.test.ts; this is about
 * the render contract — that it mounts, that the pressables carry the real
 * accessibility state, and that the duplicated label layers stay out of the
 * accessibility tree.
 */
const OPTIONS = [
  {key: 'a' as const, label: 'Friendlies'},
  {key: 'b' as const, label: 'Competitive'},
];

function render(value: 'a' | 'b', onChange = () => {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SkinProvider>
        <Segmented options={OPTIONS} value={value} onChange={onChange} />
      </SkinProvider>,
    );
  });
  return tree;
}

/**
 * Host elements only. `findAll` walks composites too, so a single pressable
 * matches once per wrapper in the chain (PressableScale → Pressable → View)
 * and every count comes out a multiple of the truth.
 */
function findHosts(
  tree: ReactTestRenderer.ReactTestRenderer,
  pred: (n: ReactTestRenderer.ReactTestInstance) => boolean,
) {
  return tree.root.findAll(n => typeof n.type === 'string' && pred(n));
}

test('marks only the selected segment as selected', () => {
  const tree = render('a');
  const buttons = findHosts(
    tree,
    n => n.props.accessibilityRole === 'button' && !!n.props.accessibilityLabel,
  );
  const state = buttons.map(b => [
    b.props.accessibilityLabel,
    b.props.accessibilityState?.selected,
  ]);
  expect(state).toEqual([
    ['Friendlies', true],
    ['Competitive', false],
  ]);
  ReactTestRenderer.act(() => tree.unmount());
});

test('hides the duplicated label layers from VoiceOver', () => {
  const tree = render('a');
  // Each segment renders its label twice (one tint per layer) to cross-fade on
  // opacity. Both copies must be hidden, or VoiceOver reads every label twice.
  const layers = findHosts(
    tree,
    n => n.props.importantForAccessibility === 'no-hide-descendants',
  );
  expect(layers.length).toBe(OPTIONS.length * 2);
  expect(layers.every(l => l.props.accessible === false)).toBe(true);
  ReactTestRenderer.act(() => tree.unmount());
});

test('fires onChange for an unselected segment only', () => {
  const onChange = jest.fn();
  const tree = render('a', onChange);
  // The composite, not the host: onPress lives on the pressable wrapper and is
  // consumed before it reaches a host view.
  const buttons = tree.root.findAllByType(PressableScale);

  ReactTestRenderer.act(() => buttons[1].props.onPress());
  expect(onChange).toHaveBeenCalledWith('b');

  // Re-pressing the live segment is a no-op, not a redundant state write.
  onChange.mockClear();
  ReactTestRenderer.act(() => buttons[0].props.onPress());
  expect(onChange).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => tree.unmount());
});
