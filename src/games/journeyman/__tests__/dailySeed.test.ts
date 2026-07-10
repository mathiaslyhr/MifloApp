import {dailyPool} from '../../scout/dailySeed';
import {
  dailySecretFor,
  journeymanPool,
  MIN_CLUB_SPELLS,
  walkSecretId,
} from '../dailySeed';
import {JOURNEYMAN_SCHEDULE} from '../schedule.generated';

describe('journeymanPool', () => {
  it('is Scout\'s fairness pool kept to travelled careers', () => {
    const pool = journeymanPool();
    const scoutIds = new Set(dailyPool().map(f => f.id));
    expect(pool.length).toBeGreaterThan(100);
    for (const f of pool) {
      expect(scoutIds.has(f.id)).toBe(true);
      expect(f.clubs.length).toBeGreaterThanOrEqual(MIN_CLUB_SPELLS);
    }
  });

  it('is deterministic across calls', () => {
    expect(journeymanPool().map(f => f.id)).toEqual(
      journeymanPool().map(f => f.id),
    );
  });
});

describe('walkSecretId', () => {
  // Epoch day-0 in UTC, so day `i` maps to dayNumber === i inside the walk.
  const keyForDay = (i: number) =>
    new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10);

  it('is deterministic per date key and stays inside the pool', () => {
    const pool = journeymanPool();
    const ids = new Set(pool.map(f => f.id));
    const a = walkSecretId('2199-06-01', pool);
    expect(walkSecretId('2199-06-01', pool)).toBe(a);
    expect(ids.has(a)).toBe(true);
  });

  it('walks a full permutation before any repeat', () => {
    const pool = journeymanPool();
    const cycle = Array.from({length: pool.length}, (_, i) =>
      walkSecretId(keyForDay(i), pool),
    );
    expect(new Set(cycle).size).toBe(pool.length);
  });

  it('reshuffles at the cycle boundary without throwing', () => {
    const pool = journeymanPool();
    const ids = new Set(pool.map(f => f.id));
    expect(ids.has(walkSecretId(keyForDay(pool.length), pool))).toBe(true);
  });
});

describe('dailySecretFor', () => {
  it('serves the schedule, falling back to the walk past the horizon', () => {
    const dates = Object.keys(JOURNEYMAN_SCHEDULE);
    const someDay = dates[Math.floor(dates.length / 2)];
    expect(dailySecretFor(someDay).id).toBe(JOURNEYMAN_SCHEDULE[someDay]);
    expect(JOURNEYMAN_SCHEDULE['2199-06-01']).toBeUndefined();
    expect(dailySecretFor('2199-06-01').id).toBe(
      walkSecretId('2199-06-01', journeymanPool()),
    );
  });
});
