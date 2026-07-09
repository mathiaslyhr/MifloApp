/* eslint-disable no-bitwise -- integer hashing / PRNG needs bitwise ops */
/**
 * Deterministic daily puzzle selection. A calendar day maps to exactly one
 * secret footballer, identical for every device: `dateKey` -> hash -> seeded
 * PRNG -> index into the fairness-filtered pool. All pure, so the same day
 * always yields the same secret and the tests can assert stability.
 */
import {FOOTBALLERS, getClub, shuffle, type Footballer, type Rng} from '../../data/football';

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
 * year) are excluded. Recognizable = has an honour, currently plays a top-5
 * league, or is hand-vetted (`wordle`). Everyone stays guessable — only the
 * *answer* is gated. Pure and deterministic (dataset order preserved).
 */
export function dailyPool(pool: readonly Footballer[] = FOOTBALLERS): Footballer[] {
  return pool.filter(f => {
    const tags = f.tags ?? [];
    const last = f.clubs[f.clubs.length - 1];
    const active = tags.includes('current-stars') || last?.to === undefined;
    if (!active) {
      return false;
    }
    if (f.honours.length > 0 || tags.includes('wordle')) {
      return true;
    }
    const current = f.clubs.find(s => s.to === undefined) ?? last;
    const league = current ? getClub(current.clubId)?.league : undefined;
    return league ? TOP5_LEAGUES.has(league) : false;
  });
}

/** Whole days from `EPOCH_KEY` to `dateKey` (UTC math avoids DST drift). */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [ey, em, ed] = EPOCH_KEY.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

/**
 * The secret footballer for a given day. A deterministic shuffled *sequence*
 * rather than an independent daily draw: each pool-length cycle of days is a
 * fresh Fisher–Yates permutation of the whole pool, walked one player per day,
 * so no footballer repeats until the entire pool is exhausted. Note this makes
 * the sequence (including today's secret) shift whenever the pool changes.
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
