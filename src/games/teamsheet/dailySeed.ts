/**
 * Deterministic daily lineup selection. A calendar day maps to exactly one
 * famous XI, identical for every device. The committed schedule
 * (schedule.generated.ts, `npm run teamsheet:schedule`, also shipped OTA) is
 * the source of truth; the seeded permutation walk below only serves dates
 * beyond the schedule's horizon. Pure, so tests can assert stability.
 *
 * Date helpers (dateKeyFor, hashDateKey, seededRng…) are shared with Scout —
 * they live in scout/dailySeed.ts and are game-agnostic.
 */
import {
  FAMOUS_LINEUPS,
  getLineupById,
  isTeamsheetLineup,
  shuffle,
  type FamousLineup,
  type LineupKit,
} from '../../data/football';
import {hashDateKey, seededRng} from '../scout/dailySeed';
import {TEAMSHEET_SCHEDULE} from './schedule.generated';

/** Epoch for the fallback walk: cycle 0, index 0 falls on this day. */
const EPOCH_KEY = '2026-07-01';

/** The lineups eligible for the daily pool (fully enriched entries only). */
export function teamsheetPool(): FamousLineup[] {
  return FAMOUS_LINEUPS.filter(isTeamsheetLineup);
}

/** Whole days from `EPOCH_KEY` to `dateKey` (UTC math avoids DST drift). */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [ey, em, ed] = EPOCH_KEY.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

/**
 * The lineup id for a given day — schedule first, walk as fallback. The walk
 * shifts whenever the pool changes (OTA packs add lineups), which is exactly
 * why scheduled dates take precedence.
 */
export function dailyLineupIdFor(dateKey: string): string {
  return TEAMSHEET_SCHEDULE[dateKey] ?? walkLineupId(dateKey, teamsheetPool());
}

/** Resolve the day's lineup, falling back to the walk if a pinned id vanished. */
export function dailyLineupFor(dateKey: string): FamousLineup {
  const scheduled = getLineupById(dailyLineupIdFor(dateKey));
  if (scheduled) {
    return scheduled;
  }
  const walked = getLineupById(walkLineupId(dateKey, teamsheetPool()));
  if (!walked) {
    throw new Error('dailyLineupFor: empty lineup pool');
  }
  return walked;
}

/**
 * Just the day's kit colours — the one spoiler-safe fact about today's Team
 * sheet. The club is public (the puzzle literally names the XI's team); only
 * the eleven player names are secret. Home reads this so it never has to touch
 * the answer object. `undefined` when the day's lineup carries no kit.
 */
export function dailyLineupKitFor(dateKey: string): LineupKit | undefined {
  return dailyLineupFor(dateKey).kit;
}

/**
 * Fallback for dates beyond the schedule horizon: each pool-length cycle of
 * days is a fresh seeded permutation of the pool (sorted by id first, so the
 * walk is independent of pack array order), walked one lineup per day — no
 * repeats until the whole pool has been played.
 */
export function walkLineupId(dateKey: string, pool: readonly FamousLineup[]): string {
  if (pool.length === 0) {
    throw new Error('walkLineupId: empty pool');
  }
  const ids = pool.map(l => l.id).sort();
  const day = dayNumber(dateKey);
  const cycle = Math.floor(day / ids.length);
  // Euclidean modulo keeps the index in range for pre-epoch dates too.
  const idx = ((day % ids.length) + ids.length) % ids.length;
  const order = shuffle(ids, seededRng(hashDateKey(`teamsheet#${EPOCH_KEY}#${cycle}`)));
  return order[idx];
}
