/**
 * The disambiguation pill: a position badge appears next to a suggestion ONLY
 * when another visible row carries the exact same name. Unique names stay clean.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {InlineSuggestions} from '../InlineSuggestions';

function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(el);
  });
  return tree;
}

// Accessibility labels of the rows, in order — a pill folds its position into
// the row's label ("Name, POS"), so this reflects exactly what got a badge.
function rowLabels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll(
      n => typeof n.type === 'string' && n.props.accessibilityRole === 'button',
    )
    .map(n => n.props.accessibilityLabel);
}

test('duplicate names get a position pill, unique names do not', () => {
  const tree = render(
    <InlineSuggestions
      items={[
        {key: 'a', label: 'Danilo', position: 'DF'},
        {key: 'b', label: 'Danilo', position: 'FW'},
        {key: 'c', label: 'Rodri', position: 'MF'},
      ]}
      onPick={() => {}}
    />,
  );
  expect(rowLabels(tree)).toEqual(['Danilo, DF', 'Danilo, FW', 'Rodri']);
});

test('no pill when position is missing even on a name clash', () => {
  const tree = render(
    <InlineSuggestions
      items={[
        {key: 'a', label: 'Danilo'},
        {key: 'b', label: 'Danilo'},
      ]}
      onPick={() => {}}
    />,
  );
  expect(rowLabels(tree)).toEqual(['Danilo', 'Danilo']);
});
