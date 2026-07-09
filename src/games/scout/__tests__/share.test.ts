import {buildShareGrid} from '../share';
import type {CellResult, MysteryState} from '../types';

const row = (...statuses: CellResult['status'][]): {footballerId: string; cells: CellResult[]} => ({
  footballerId: 'x',
  cells: statuses.map(status => ({key: 'nationality', status} as CellResult)),
});

describe('buildShareGrid', () => {
  it('renders a win in three with an n/∞ header', () => {
    const state: MysteryState = {
      dateKey: '2026-07-07',
      secretId: 's',
      status: 'won',
      guesses: [
        row('miss', 'miss', 'partial', 'miss', 'miss'),
        row('hit', 'miss', 'partial', 'partial', 'miss'),
        row('hit', 'hit', 'hit', 'hit', 'hit'),
      ],
    };
    expect(buildShareGrid(state)).toBe(
      [
        'Scout 2026-07-07 3/∞',
        '⬛⬛🟨⬛⬛',
        '🟩⬛🟨🟨⬛',
        '🟩🟩🟩🟩🟩',
      ].join('\n'),
    );
  });

  it('keeps counting past the old six-guess cap', () => {
    const state: MysteryState = {
      dateKey: '2026-07-07',
      secretId: 's',
      status: 'won',
      guesses: Array.from({length: 11}, () => row('miss', 'miss', 'miss', 'miss', 'miss')),
    };
    expect(buildShareGrid(state).split('\n')[0]).toBe('Scout 2026-07-07 11/∞');
  });
});
