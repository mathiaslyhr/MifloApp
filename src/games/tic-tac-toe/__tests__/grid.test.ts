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
});
