import {tieExampleAnswers} from '../tieExamples';
import {intersection, matches} from '../../../data/football';
import {famePrior} from '../../cult-hero/famePrior';
import type {Criterion} from '../../../data/football';
import {cellCriteria} from '../engine';
import type {GridState} from '../types';

// Real-dataset criteria so intersections are meaningfully non-empty.
const ROWS: Criterion[] = [
  {kind: 'nationality', country: 'Brazil'},
  {kind: 'nationality', country: 'France'},
  {kind: 'nationality', country: 'Argentina'},
];
const COLS: Criterion[] = [
  {kind: 'position', position: 'FW'},
  {kind: 'position', position: 'MF'},
  {kind: 'position', position: 'DF'},
];

function tiedState(overrides: Partial<GridState> = {}): GridState {
  return {
    gameType: 'hattrick',
    mode: 'individual',
    rows: ROWS,
    cols: COLS,
    board: Array(9).fill(null),
    sides: [
      {id: 'A', color: '#111', name: 'A', memberUserIds: ['A']},
      {id: 'B', color: '#222', name: 'B', memberUserIds: ['B']},
    ],
    order: ['A', 'B'],
    turnUserId: 'A',
    turnDeadline: Number.MAX_SAFE_INTEGER,
    usedFootballerIds: [],
    winner: 'tie',
    ...overrides,
  };
}

describe('tieExampleAnswers', () => {
  it('returns nothing while the game is still running or after a win', () => {
    expect(tieExampleAnswers(tiedState({winner: null})).size).toBe(0);
    expect(tieExampleAnswers(tiedState({winner: 'A'})).size).toBe(0);
  });

  it('gives every empty cell a valid, unused, distinct example', () => {
    const used = intersection(ROWS[0], COLS[0]).slice(0, 2);
    const state = tiedState({
      board: [
        {sideId: 'A', footballerId: used[0].id},
        null, null, null,
        {sideId: 'B', footballerId: used[1].id},
        null, null, null, null,
      ],
      usedFootballerIds: used.map(f => f.id),
    });

    const examples = tieExampleAnswers(state);

    expect(examples.size).toBe(7);
    expect(examples.has(0)).toBe(false);
    expect(examples.has(4)).toBe(false);
    const ids = new Set<string>();
    for (const [index, f] of examples) {
      const {row, col} = cellCriteria(state, index);
      expect(matches(f, row)).toBe(true);
      expect(matches(f, col)).toBe(true);
      expect(state.usedFootballerIds).not.toContain(f.id);
      ids.add(f.id);
    }
    expect(ids.size).toBe(7); // disjoint across cells
  });

  it('picks the most famous remaining candidate', () => {
    const board = intersection(ROWS[0], COLS[0])
      .slice(0, 8)
      .map(f => ({sideId: 'A', footballerId: f.id}));
    const state = tiedState({
      board: [...board, null],
      usedFootballerIds: board.map(c => c.footballerId),
    });

    const example = tieExampleAnswers(state).get(8);

    const {row, col} = cellCriteria(state, 8);
    const best = intersection(row, col)
      .filter(f => !state.usedFootballerIds.includes(f.id))
      .sort((a, b) => famePrior(b) - famePrior(a) || a.id.localeCompare(b.id))[0];
    expect(example?.id).toBe(best.id);
  });

  it('leaves a cell blank when no candidates remain', () => {
    const state = tiedState({
      rows: [{kind: 'nationality', country: 'Atlantis'}, ROWS[1], ROWS[2]],
    });
    const examples = tieExampleAnswers(state);
    expect(examples.has(0)).toBe(false);
    expect(examples.has(1)).toBe(false);
    expect(examples.has(2)).toBe(false);
    expect(examples.size).toBe(6);
  });
});
