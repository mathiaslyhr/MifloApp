import {generateGrid} from '../grid';
import {intersection} from '../../../data/football';

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
