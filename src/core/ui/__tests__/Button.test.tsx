/**
 * Button press routing — especially `onDisabledPress`, which keeps a disabled
 * button tappable so screens can explain why an action is unavailable.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Button} from '../Button';

function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(el);
  });
  return tree;
}

// The Pressable hosting the button: the outermost node announced as a button.
// (Pressable is a memo component, so findByType can't target it directly.)
function findPressable(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(n => n.props.accessibilityRole === 'button')[0];
}

test('enabled button fires onPress', () => {
  const onPress = jest.fn();
  const tree = render(<Button label="Go" onPress={onPress} />);
  act(() => {
    findPressable(tree).props.onPress();
  });
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('disabled button without onDisabledPress is inert', () => {
  const onPress = jest.fn();
  const tree = render(<Button label="Go" onPress={onPress} disabled />);
  const pressable = findPressable(tree);
  expect(pressable.props.disabled).toBe(true);
  expect(pressable.props.onPress).toBeUndefined();
  expect(onPress).not.toHaveBeenCalled();
});

test('disabled button with onDisabledPress fires it instead of onPress', () => {
  const onPress = jest.fn();
  const onDisabledPress = jest.fn();
  const tree = render(
    <Button
      label="Go"
      onPress={onPress}
      onDisabledPress={onDisabledPress}
      disabled
    />,
  );
  const pressable = findPressable(tree);
  expect(pressable.props.disabled).toBe(false);
  act(() => {
    pressable.props.onPress();
  });
  expect(onDisabledPress).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
  // Still announced as disabled to assistive tech.
  expect(pressable.props.accessibilityState).toEqual({disabled: true});
});
