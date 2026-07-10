/**
 * Deterministic daily secret selection for Journeyman. A calendar day maps to
 * exactly one footballer, identical for every device. The committed schedule
 * (schedule.generated.ts, `npm run journeyman:schedule`, also shipped OTA) is
 * the source of truth; the seeded permutation walk below only serves dates
 * beyond the schedule's horizon. Pure, so tests can assert stability.
 *
 * Date helpers (dateKeyFor, hashDateKey, seededRng…) are shared with Scout —
 * they live in scout/dailySeed.ts and are game-agnostic.
 */
import {FOOTBALLERS, getById, shuffle, type Footballer} from '../../data/football';
import {dailyPool, hashDateKey, seededRng} from '../scout/dailySeed';
import {JOURNEYMAN_SCHEDULE} from './schedule.generated';

/** Epoch for the fallback walk: cycle 0, index 0 falls on this day. */
const EPOCH_KEY = '2026-07-01';

/**
 * A career must have at least this many club spells to make a puzzle — one or
 * two rows read as a lookup, not a journey.
 */
export const MIN_CLUB_SPELLS = 3;

/**
 * The candidate secrets: Scout's fairness pool (active + recognizable), kept
 * to players whose career actually travels. Pure and deterministic — the
 * schedule generator and the runtime fallback both call this exact function,
 * and schedule.test.ts pins its fingerprint via POOL_SIGNATURE.
 */
export function journeymanPool(pool: readonly Footballer[] = FOOTBALLERS): Footballer[] {
  return dailyPool(pool).filter(f => f.clubs.length >= MIN_CLUB_SPELLS);
}

/** Whole days from `EPOCH_KEY` to `dateKey` (UTC math avoids DST drift). */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [ey, em, ed] = EPOCH_KEY.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

/**
 * The secret footballer for a given day — schedule first, walk as fallback.
 * The walk shifts whenever the pool changes (dataset edits arrive OTA), which
 * is exactly why scheduled dates take precedence.
 */
export function dailySecretFor(dateKey: string): Footballer {
  const scheduledId = JOURNEYMAN_SCHEDULE[dateKey];
  if (scheduledId !== undefined) {
    const scheduled = getById(scheduledId);
    if (scheduled) {
      return scheduled;
    }
  }
  const walked = getById(walkSecretId(dateKey, journeymanPool()));
  if (!walked) {
    throw new Error('dailySecretFor: empty pool');
  }
  return walked;
}

/**
 * Fallback for dates beyond the schedule horizon: each pool-length cycle of
 * days is a fresh seeded permutation of the pool (sorted by id first, so the
 * walk is independent of pack array order), walked one player per day — no
 * repeats until the whole pool has been played.
 */
export function walkSecretId(dateKey: string, pool: readonly Footballer[]): string {
  if (pool.length === 0) {
    throw new Error('walkSecretId: empty pool');
  }
  const ids = pool.map(f => f.id).sort();
  const day = dayNumber(dateKey);
  const cycle = Math.floor(day / ids.length);
  // Euclidean modulo keeps the index in range for pre-epoch dates too.
  const idx = ((day % ids.length) + ids.length) % ids.length;
  const order = shuffle(ids, seededRng(hashDateKey(`journeyman#${EPOCH_KEY}#${cycle}`)));
  return order[idx];
}
