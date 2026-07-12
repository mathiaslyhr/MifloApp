/**
 * Pure helpers for recording a finished online game (0031). No React, no
 * backend — kept separate (like careerStats.ts) so they're trivially
 * unit-testable. The host turns a game's final standings into the per-player
 * rows record_game_results stores, keyed by a stable per-instance match id.
 */
import type {ResultEntry} from './types';

/** One player's line on a game's board: their id, name and final points. */
export type Standing = {userId: string; name: string; score: number};

/**
 * Turn a board into finish rows. Sorted by score (desc), ties broken by name so
 * ranks are stable; tied scores share a rank (1, 1, 3…). `is_winner` marks
 * everyone at the top score, but only when someone actually scored — an all-zero
 * board (nobody scored, or a Hattrick tie encoded as 0/0) has no winner, so it
 * reads as a draw in the head-to-head rather than a shared win.
 */
export function entriesFromStandings(board: readonly Standing[]): ResultEntry[] {
  const sorted = [...board].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
  const top = sorted.length ? sorted[0].score : 0;
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((row, i) => {
    if (prev === null || row.score !== prev) {
      rank = i + 1;
      prev = row.score;
    }
    return {
      user_id: row.userId,
      name: row.name,
      score: row.score,
      rank,
      is_winner: top > 0 && row.score === top,
    };
  });
}

/**
 * A stable id for one game instance: the room id plus an FNV-1a hash of that
 * game's random content signature (the deck, prompts, grid axes or hand
 * questions). Deterministic — a reconnect that re-records the same game yields
 * the same id (so the upsert is a no-op, never a duplicate) — yet unique per
 * instance, since a rematch draws fresh content and hashes differently. The
 * room id prefix keeps ids from ever colliding across rooms.
 */
export function matchIdFrom(roomId: string, signature: string): string {
  /* eslint-disable no-bitwise -- FNV-1a is inherently bitwise. */
  let h = 0x811c9dc5;
  for (let i = 0; i < signature.length; i++) {
    h ^= signature.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${roomId}:${(h >>> 0).toString(16).padStart(8, '0')}`;
  /* eslint-enable no-bitwise */
}
