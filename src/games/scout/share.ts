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

/** The `n/6` (win) or `X/6` (loss) score line. */
function scoreLine(state: MysteryState): string {
  const score = state.status === 'won' ? `${state.guesses.length}` : 'X';
  return `${score}/${state.maxGuesses}`;
}

/** Build the shareable text block for a finished puzzle. */
export function buildShareGrid(state: MysteryState): string {
  const header = `Scout ${state.dateKey} ${scoreLine(state)}`;
  const rows = state.guesses.map(g =>
    g.cells.map(c => SQUARE[c.status]).join(''),
  );
  return [header, ...rows].join('\n');
}
