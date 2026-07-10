/**
 * Detailed position labels (GK, RB/LB, RWB/LWB, CB, DM, CM, AM, RM/LM,
 * RW/LW, ST) derived from the formation shape alone — the data only stores
 * coarse GK/DF/MF/FW buckets. Labels follow the board convention from
 * CURATION.md: rows run GK first then defence to attack, and within a row
 * right to left (RB first). Flat-midfield wide men are RM/LM, the wide men
 * of a back five or of the band in front of a back three are wing-backs,
 * and the band behind a lone striker is the attacking RW/AM/LW line.
 * Purely cosmetic hints above each token; heuristic by design.
 */

/** "4-2-3-1" -> [1, 4, 2, 3, 1]: the GK row plus one row per formation line. */
export function formationRows(formation: string): number[] {
  const rows = formation
    .split('-')
    .map(n => parseInt(n, 10))
    .filter(n => Number.isFinite(n) && n > 0);
  return [1, ...rows];
}

/** One label per player array slot (index 0 = GK), aligned with the rows. */
export function positionLabels(formation: string): string[] {
  const rows = formationRows(formation);
  const labels: string[] = [];
  const lastRow = rows.length - 1;
  const attackSize = rows[lastRow];
  const defenceSize = rows[1] ?? 0;

  const flanked = (size: number, right: string, left: string, middle: string) => {
    for (let i = 0; i < size; i++) {
      labels.push(i === 0 ? right : i === size - 1 ? left : middle);
    }
  };

  rows.forEach((size, rowIdx) => {
    if (rowIdx === 0) {
      labels.push('GK');
      return;
    }
    if (rowIdx === 1) {
      // Defence: full-backs outside a four, wing-backs outside a five.
      if (size >= 5) {
        flanked(size, 'RWB', 'LWB', 'CB');
      } else if (size === 4) {
        flanked(size, 'RB', 'LB', 'CB');
      } else {
        for (let i = 0; i < size; i++) {
          labels.push('CB');
        }
      }
      return;
    }
    if (rowIdx === lastRow) {
      // Attack: wingers flank a three or four, strikers in the middle.
      if (size >= 3) {
        flanked(size, 'RW', 'LW', 'ST');
      } else {
        for (let i = 0; i < size; i++) {
          labels.push('ST');
        }
      }
      return;
    }
    // Midfield rows.
    const isFirstMiddle = rowIdx === 2;
    const isLastMiddle = rowIdx === lastRow - 1;
    if (isLastMiddle && size === 1) {
      labels.push('AM');
      return;
    }
    if (isLastMiddle && !isFirstMiddle && attackSize === 1 && size >= 2) {
      // The band behind a lone striker (when a holding band sits beneath it):
      // wingers wide, playmakers inside. A LONE middle band stays flat (4-5-1).
      if (size >= 3) {
        flanked(size, 'RW', 'LW', 'AM');
      } else {
        labels.push('AM', 'AM');
      }
      return;
    }
    if (isFirstMiddle && size <= 2) {
      for (let i = 0; i < size; i++) {
        labels.push('DM');
      }
      return;
    }
    if (size >= 4) {
      // Flat wide midfielders in front of a back four; wing-backs when the
      // width comes from this band in front of a back three.
      if (defenceSize === 3) {
        flanked(size, 'RWB', 'LWB', 'CM');
      } else {
        flanked(size, 'RM', 'LM', 'CM');
      }
      return;
    }
    for (let i = 0; i < size; i++) {
      labels.push('CM');
    }
  });
  return labels;
}
