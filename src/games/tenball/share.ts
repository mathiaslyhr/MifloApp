/**
 * The shareable result line — a compact emoji board built purely from the
 * finished state, so it is deterministic and snapshot-testable. One square per
 * rank slot in rank order: found slots are green, slots exposed by giving up
 * are white.
 */
import {foundRanks, missCount} from './engine';
import type {TenballState} from './types';

/** Build the shareable text block for a finished board. */
export function buildShareText(state: TenballState): string {
  const found = foundRanks(state);
  const squares = Array.from({length: 10}, (_, i) =>
    found.has(i + 1) ? '🟩' : '⬜',
  ).join('');
  const misses = missCount(state);
  const score =
    state.status === 'won'
      ? `${misses} ${misses === 1 ? 'miss' : 'misses'}`
      : `${found.size}/10`;
  return [`Top Bins ${state.dateKey} · ${score}`, squares].join('\n');
}
