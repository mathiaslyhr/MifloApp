/**
 * The shareable result grid — a Wordle-style emoji block built purely from the
 * finished state, so it is deterministic and snapshot-testable. Pure squares
 * (no arrows) keep the paste clean across apps.
 */
import type {CellStatus, MysteryState} from './types';

const SQUARE: Record<CellStatus, string> = {
  hit: '🟩',
  partial: '🟨',
  miss: '⬛',
};

/** The `n/∞` score line — guesses are unlimited, so the count is the score. */
function scoreLine(state: MysteryState): string {
  return `${state.guesses.length}/∞`;
}

/** Build the shareable text block for a finished puzzle. */
export function buildShareGrid(state: MysteryState): string {
  const header = `Scout ${state.dateKey} ${scoreLine(state)}`;
  const rows = state.guesses.map(g =>
    g.cells.map(c => SQUARE[c.status]).join(''),
  );
  return [header, ...rows].join('\n');
}
