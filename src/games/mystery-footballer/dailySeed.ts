/* eslint-disable no-bitwise -- integer hashing / PRNG needs bitwise ops */
/**
 * Deterministic daily puzzle selection. A calendar day maps to exactly one
 * secret footballer, identical for every device: `dateKey` -> hash -> seeded
 * PRNG -> index into the fairness-filtered pool. All pure, so the same day
 * always yields the same secret and the tests can assert stability.
 */
import {FOOTBALLERS, getClub, type Footballer, type Rng} from '../../data/football';

/** The "top-5" European leagues, used to gate the daily pool for recognizability. */
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
 * The candidate players for the daily secret. Restricted to recognizable names
 * so the puzzle is guessable: a legend/current-star who has either won a real
 * honour or currently plays in a top-5 league. Pure and deterministic (dataset
 * order preserved), so the pool is stable across runs.
 */
export function dailyPool(pool: readonly Footballer[] = FOOTBALLERS): Footballer[] {
  return pool.filter(f => {
    const tags = f.tags ?? [];
    const tagged = tags.includes('legends') || tags.includes('current-stars');
    if (!tagged) {
      return false;
    }
    if (f.honours.length > 0) {
      return true;
    }
    const active = f.clubs.find(s => s.to === undefined);
    const league = active ? getClub(active.clubId)?.league : undefined;
    return league ? TOP5_LEAGUES.has(league) : false;
  });
}

/** The secret footballer for a given day, drawn deterministically from `pool`. */
export function secretFor(dateKey: string, pool: readonly Footballer[]): Footballer {
  if (pool.length === 0) {
    throw new Error('secretFor: empty pool');
  }
  const rng = seededRng(hashDateKey(dateKey));
  return pool[Math.floor(rng() * pool.length)];
}
