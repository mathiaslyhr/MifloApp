import {buildShareGrid} from '../share';
import type {CellResult, MysteryState} from '../types';

const row = (...statuses: CellResult['status'][]): {footballerId: string; cells: CellResult[]} => ({
  footballerId: 'x',
  cells: statuses.map(status => ({key: 'nationality', status} as CellResult)),
});

describe('buildShareGrid', () => {
  it('renders a win in three with an n/6 header', () => {
    const state: MysteryState = {
      dateKey: '2026-07-07',
      secretId: 's',
      maxGuesses: 6,
      status: 'won',
      guesses: [
        row('miss', 'miss', 'partial', 'miss', 'miss', 'miss'),
        row('hit', 'miss', 'partial', 'partial', 'miss', 'miss'),
        row('hit', 'hit', 'hit', 'hit', 'hit', 'hit'),
      ],
    };
    expect(buildShareGrid(state)).toBe(
      [
        'Mystery Footballer 2026-07-07 3/6',
        '⬛⬛🟨⬛⬛⬛',
        '🟩⬛🟨🟨⬛⬛',
        '🟩🟩🟩🟩🟩🟩',
      ].join('\n'),
    );
  });

  it('renders a loss as X/6', () => {
    const state: MysteryState = {
      dateKey: '2026-07-07',
      secretId: 's',
      maxGuesses: 6,
      status: 'lost',
      guesses: [row('miss', 'miss', 'miss', 'miss', 'miss', 'miss')],
    };
    expect(buildShareGrid(state).split('\n')[0]).toBe('Mystery Footballer 2026-07-07 X/6');
  });
});
