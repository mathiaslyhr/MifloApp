import {candidatePool, generateGrid, hasDisjointAssignment} from '../grid';
import {intersection} from '../../../data/football';
import {bundledSnapshot, hydrate} from '../../../data/football/store';

describe('hasDisjointAssignment', () => {
  it('rejects pools that only look solvable via a shared player', () => {
    // Two cells both rely on "a": counts say 1 each, but he can only fill one.
    expect(hasDisjointAssignment([['a'], ['a'], ['b']], 1)).toBe(false);
    // Three cells sharing the same two players: 2 per cell by count, but only
    // two distinct footballers exist for six slots.
    expect(
      hasDisjointAssignment([['a', 'b'], ['a', 'b'], ['a', 'b']], 2),
    ).toBe(false);
  });

  it('accepts pools with enough distinct players, even when shared', () => {
    expect(hasDisjointAssignment([['a', 'b'], ['a', 'c'], ['a', 'd']], 1)).toBe(
      true,
    );
    // Needs the augmenting path: greedy could burn "a"+"b" on the first cell.
    expect(
      hasDisjointAssignment(
        [
          ['a', 'b', 'c', 'd'],
          ['a', 'b', 'e', 'f'],
          ['c', 'd', 'e', 'f'],
        ],
        2,
      ),
    ).toBe(true);
    expect(hasDisjointAssignment([], 2)).toBe(true);
  });
});

describe('generateGrid', () => {
  it('always yields a fully solvable 3×3 (every cell has ≥1 footballer)', () => {
    for (let i = 0; i < 50; i++) {
      const {rows, cols} = generateGrid();
      expect(rows).toHaveLength(3);
      expect(cols).toHaveLength(3);
      for (const r of rows) {
        for (const c of cols) {
          expect(intersection(r, c).length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('gives every cell 2 dedicated footballers (18 distinct across the grid)', () => {
    for (let i = 0; i < 50; i++) {
      const {rows, cols} = generateGrid();
      const cellIds = rows.flatMap(r =>
        cols.map(c => intersection(r, c).map(f => f.id)),
      );
      expect(hasDisjointAssignment(cellIds, 2)).toBe(true);
    }
  });

  it('rarely lets a single superstar answer most of the grid', () => {
    // The dominance guard should keep the peak player coverage low on the vast
    // majority of grids (fallback may occasionally exceed it, hence a margin).
    let overCap = 0;
    const runs = 100;
    for (let i = 0; i < runs; i++) {
      const {rows, cols} = generateGrid();
      const perPlayer = new Map<string, number>();
      let peak = 0;
      for (const r of rows) {
        for (const c of cols) {
          for (const f of intersection(r, c)) {
            const n = (perPlayer.get(f.id) ?? 0) + 1;
            perPlayer.set(f.id, n);
            peak = Math.max(peak, n);
          }
        }
      }
      if (peak > 4) {
        overCap++;
      }
    }
    // Comfortably under 20% of grids should breach the cap via fallback.
    expect(overCap).toBeLessThan(runs * 0.2);
  });
});

describe('candidatePool', () => {
  afterEach(() => {
    hydrate(bundledSnapshot());
  });

  it('reuses the built catalog across calls (game starts stay cheap)', () => {
    expect(candidatePool()).toBe(candidatePool());
  });

  it('rebuilds after an OTA hydrate so new data reaches the grid', () => {
    const before = candidatePool();
    hydrate(bundledSnapshot());
    const after = candidatePool();
    expect(after).not.toBe(before);
    // And grids still generate from the rebuilt catalog.
    expect(generateGrid().cols).toHaveLength(3);
  });
});
