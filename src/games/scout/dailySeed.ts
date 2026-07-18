/* eslint-disable no-bitwise -- integer hashing / PRNG needs bitwise ops */
/**
 * Deterministic daily puzzle selection. A calendar day maps to exactly one
 * secret footballer, identical for every device: `dateKey` -> hash -> seeded
 * PRNG -> index into the fairness-filtered pool. All pure, so the same day
 * always yields the same secret and the tests can assert stability.
 */
import {FOOTBALLERS, getById, leaguesOf, shuffle, type Footballer, type Rng} from '../../data/football';
import {famePrior} from '../cult-hero/famePrior';
import {DAILY_SECRETS} from './schedule.generated';

/** Epoch for the daily sequence: cycle 0, index 0 falls on this day. */
const EPOCH_KEY = '2026-01-01';

/** The "top-5" European leagues — gates the daily pool for recognizability. */
const TOP5_LEAGUES = new Set([
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
]);

/**
 * Notability floor (a `famePrior` score) a **rest-of-world** player must clear
 * to be a daily answer. Top-5-league careers are recognizable by default; a
 * player with no top-5 pedigree needs real editorial fame to qualify, so an
 * obscure honour-holder like a Scottish-only cup winner is never the secret.
 */
const SCOUT_FAME_FLOOR = 10;

/** Local calendar day as `YYYY-MM-DD`. The single source of the daily boundary. */
export function dateKeyFor(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The `dateKey` of the day before the given one (local time). */
export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  // Noon avoids any DST edge shifting the calendar day.
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() - 1);
  return dateKeyFor(date);
}

/** The `count` days immediately before `todayKey`, most recent first. */
export function pastDateKeys(todayKey: string, count: number): string[] {
  const keys: string[] = [];
  let key = todayKey;
  for (let i = 0; i < count; i++) {
    key = previousDateKey(key);
    keys.push(key);
  }
  return keys;
}

/** Deterministic 32-bit hash of a string (xmur3). */
export function hashDateKey(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** A seeded PRNG (mulberry32) returning the injectable `Rng` the data layer uses. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The candidate players for the daily secret: **active + recognizable** only.
 * Active = tagged `current-stars`, or a still-open club spell (catches active
 * "legends" like Messi/Ronaldo); **retired** legends (last spell has an end
 * year) are excluded.
 *
 * Recognizable is a notability *step*, not "has any honour" (which let obscure
 * small-league cup winners through and made Palma-in-Scotland an answer):
 *   - `wordle` tag  → hand-vetted, always in (force-include a name the fame
 *                     score can't see, e.g. a beloved rest-of-world legend);
 *   - top-5-league career exposure → recognizable by default (keeps every
 *     Premier League / La Liga / … player, honours or not);
 *   - otherwise (rest of the world) → only if `famePrior >= SCOUT_FAME_FLOOR`.
 *
 * Everyone stays guessable — only the *answer* is gated. Pure and
 * deterministic (dataset order preserved).
 */
export function dailyPool(pool: readonly Footballer[] = FOOTBALLERS): Footballer[] {
  return pool.filter(f => {
    const tags = f.tags ?? [];
    const last = f.clubs[f.clubs.length - 1];
    const active = tags.includes('current-stars') || last?.to === undefined;
    if (!active) {
      return false;
    }
    if (tags.includes('wordle')) {
      return true;
    }
    if (leaguesOf(f).some(l => TOP5_LEAGUES.has(l))) {
      return true;
    }
    return famePrior(f) >= SCOUT_FAME_FLOOR;
  });
}

/** Whole days from `EPOCH_KEY` to `dateKey` (UTC math avoids DST drift). */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [ey, em, ed] = EPOCH_KEY.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

/**
 * The secret footballer for a given day — schedule first, walk as fallback.
 *
 * The committed schedule (schedule.generated.ts, `npm run scout:schedule`) is
 * the source of truth: an explicit dateKey -> id map, so dataset edits can
 * never move a scheduled day and every app version agrees on the player. The
 * permutation walk below only serves dates beyond the schedule's horizon.
 */
export function dailySecretFor(dateKey: string): Footballer {
  const scheduledId = DAILY_SECRETS[dateKey];
  if (scheduledId !== undefined) {
    const scheduled = getById(scheduledId);
    if (scheduled) {
      return scheduled;
    }
  }
  return secretFor(dateKey, dailyPool());
}

/**
 * Fallback for dates beyond the schedule horizon: a deterministic shuffled
 * *sequence* rather than an independent daily draw — each pool-length cycle of
 * days is a fresh Fisher–Yates permutation of the whole pool, walked one
 * player per day, so no footballer repeats until the pool is exhausted. The
 * sequence shifts whenever the pool changes, which is exactly why scheduled
 * dates take precedence.
 */
export function secretFor(dateKey: string, pool: readonly Footballer[]): Footballer {
  if (pool.length === 0) {
    throw new Error('secretFor: empty pool');
  }
  const day = dayNumber(dateKey);
  const cycle = Math.floor(day / pool.length);
  // Euclidean modulo keeps the index in range for pre-epoch dates too.
  const idx = ((day % pool.length) + pool.length) % pool.length;
  const order = shuffle(pool, seededRng(hashDateKey(`${EPOCH_KEY}#${cycle}`)));
  return order[idx];
}
