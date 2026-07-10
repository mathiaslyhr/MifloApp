/**
 * Deterministic daily list selection. A calendar day maps to exactly one
 * curated top-10 list, identical for every device. The committed schedule
 * (schedule.generated.ts, `npm run tenball:schedule`, also shipped OTA) is the
 * source of truth; the seeded permutation walk below only serves dates beyond
 * the schedule's horizon. Pure, so tests can assert stability.
 *
 * Date helpers (dateKeyFor, hashDateKey, seededRng…) are shared with Scout —
 * they live in scout/dailySeed.ts and are game-agnostic.
 */
import {shuffle} from '../../data/football';
import {hashDateKey, seededRng} from '../scout/dailySeed';
import {getListById, LIST_POOL} from './lists';
import {TENBALL_SCHEDULE} from './schedule.generated';
import type {TenballList} from './types';

/** Epoch for the fallback walk: cycle 0, index 0 falls on this day. */
const EPOCH_KEY = '2026-07-01';

/** Whole days from `EPOCH_KEY` to `dateKey` (UTC math avoids DST drift). */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [ey, em, ed] = EPOCH_KEY.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

/**
 * The list id for a given day — schedule first, walk as fallback. The walk
 * shifts whenever the pool changes (OTA packs add lists), which is exactly
 * why scheduled dates take precedence.
 */
export function dailyListIdFor(dateKey: string): string {
  return TENBALL_SCHEDULE[dateKey] ?? walkListId(dateKey, LIST_POOL);
}

/** Resolve the day's list, falling back to the walk if a pinned id vanished. */
export function dailyListFor(dateKey: string): TenballList {
  const scheduled = getListById(dailyListIdFor(dateKey));
  if (scheduled) {
    return scheduled;
  }
  const walked = getListById(walkListId(dateKey, LIST_POOL));
  if (!walked) {
    throw new Error('dailyListFor: empty list pool');
  }
  return walked;
}

/**
 * Fallback for dates beyond the schedule horizon: each pool-length cycle of
 * days is a fresh seeded permutation of the pool (sorted by id first, so the
 * walk is independent of pack array order), walked one list per day — no
 * repeats until the whole pool has been played.
 */
export function walkListId(dateKey: string, pool: readonly TenballList[]): string {
  if (pool.length === 0) {
    throw new Error('walkListId: empty pool');
  }
  const ids = pool.map(l => l.id).sort();
  const day = dayNumber(dateKey);
  const cycle = Math.floor(day / ids.length);
  // Euclidean modulo keeps the index in range for pre-epoch dates too.
  const idx = ((day % ids.length) + ids.length) % ids.length;
  const order = shuffle(ids, seededRng(hashDateKey(`tenball#${EPOCH_KEY}#${cycle}`)));
  return order[idx];
}
