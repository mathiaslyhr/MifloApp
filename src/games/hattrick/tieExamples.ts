import type {Footballer} from '../../data/football';
import {intersection} from '../../data/football';
import {famePrior} from '../cult-hero/famePrior';
import {cellCriteria} from './engine';
import type {GridState} from './types';

/**
 * "What could have been": one example valid answer for each cell still empty
 * when a game ends in an agreed tie. Deterministic (most famous first, id as
 * tiebreak) so both online clients render the same ghosts, and disjoint across
 * cells like the grid's fairness guarantee. A cell whose candidates ran out
 * stays blank.
 */
export function tieExampleAnswers(state: GridState): Map<number, Footballer> {
  const examples = new Map<number, Footballer>();
  // Shown after an agreed tie, or a solo surrender — both end the board early
  // with empty cells worth revealing. A played-out win never shows ghosts.
  if (state.winner !== 'tie' && state.endReason !== 'surrender') {
    return examples;
  }
  const used = new Set(state.usedFootballerIds);
  const emptyCells = state.board
    .map((cell, index) => ({cell, index}))
    .filter(({cell}) => cell === null)
    .map(({index}) => {
      const {row, col} = cellCriteria(state, index);
      const candidates = intersection(row, col)
        .filter(f => !used.has(f.id))
        .sort(
          (a, b) => famePrior(b) - famePrior(a) || a.id.localeCompare(b.id),
        );
      return {index, candidates};
    })
    // Tightest cells pick first so the greedy disjoint assignment succeeds.
    .sort((a, b) => a.candidates.length - b.candidates.length);
  const taken = new Set<string>();
  for (const {index, candidates} of emptyCells) {
    const pick = candidates.find(f => !taken.has(f.id));
    if (pick) {
      taken.add(pick.id);
      examples.set(index, pick);
    }
  }
  return examples;
}
