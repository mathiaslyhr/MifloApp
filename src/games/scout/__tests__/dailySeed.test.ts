import {
  dailyPool,
  dateKeyFor,
  pastDateKeys,
  previousDateKey,
  secretFor,
  seededRng,
} from '../dailySeed';
import {FOOTBALLERS, getById} from '../../../data/football';

describe('dateKeyFor / previousDateKey', () => {
  it('formats a local calendar day as YYYY-MM-DD', () => {
    expect(dateKeyFor(new Date(2026, 6, 7, 9, 30))).toBe('2026-07-07');
    expect(dateKeyFor(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('rolls back across month and year boundaries', () => {
    expect(previousDateKey('2026-07-07')).toBe('2026-07-06');
    expect(previousDateKey('2026-07-01')).toBe('2026-06-30');
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31');
  });

  it('lists the N days before today, most recent first', () => {
    expect(pastDateKeys('2026-07-03', 3)).toEqual(['2026-07-02', '2026-07-01', '2026-06-30']);
    expect(pastDateKeys('2026-07-07', 14)).toHaveLength(14);
    expect(pastDateKeys('2026-07-07', 14)).not.toContain('2026-07-07');
  });
});

describe('seededRng', () => {
  it('is deterministic for a given seed and spreads across [0,1)', () => {
    const a = seededRng(123);
    const b = seededRng(123);
    const seq = Array.from({length: 5}, () => a());
    expect(Array.from({length: 5}, () => b())).toEqual(seq);
    expect(seq.every(n => n >= 0 && n < 1)).toBe(true);
  });
});

describe('dailyPool', () => {
  it('is a stable non-trivial subset of the dataset', () => {
    const pool = dailyPool();
    expect(pool.length).toBeGreaterThan(100);
    expect(pool.length).toBeLessThan(FOOTBALLERS.length);
    // Deterministic order preserved across calls.
    expect(dailyPool().map(f => f.id)).toEqual(pool.map(f => f.id));
  });

  it('gates rest-of-world answers by notability, not honours', () => {
    const ids = new Set(dailyPool().map(f => f.id));
    // Honour-laden global stars are always in.
    expect(ids.has('Messi, Lionel')).toBe(true);
    expect(ids.has('Ronaldo, Cristiano')).toBe(true);
    // Top-5-league career = recognizable by default, honours or not: Abraham
    // (Chelsea/Roma) has zero honours yet is a fair, known secret.
    const abraham = getById('Abraham, Tammy');
    expect(abraham?.honours).toHaveLength(0);
    expect(ids.has('Abraham, Tammy')).toBe(true);
    // Rest of the world without top-5 pedigree needs real fame: Palma has
    // Scottish honours but no top-5 career and a fame prior below the floor,
    // so he is too obscure to be the daily secret.
    expect(getById('Palma, Luis')?.honours.length).toBeGreaterThan(0);
    expect(ids.has('Palma, Luis')).toBe(false);
  });
});

describe('secretFor', () => {
  it('is deterministic per date key', () => {
    const pool = dailyPool();
    const a = secretFor('2026-07-07', pool);
    expect(secretFor('2026-07-07', pool).id).toBe(a.id);
    expect(pool).toContain(a);
  });

  it('spreads different days across the pool', () => {
    const pool = dailyPool();
    const days = Array.from({length: 30}, (_, i) =>
      secretFor(`2026-07-${`${i + 1}`.padStart(2, '0')}`, pool).id,
    );
    // Not all the same secret — the seed actually varies the pick.
    expect(new Set(days).size).toBeGreaterThan(5);
  });

  // `EPOCH_KEY` day-0 in UTC, so day `i` maps to dayNumber === i inside secretFor.
  const keyForDay = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);

  it('walks a full permutation before any repeat', () => {
    const pool = dailyPool();
    const cycle = Array.from({length: pool.length}, (_, i) => secretFor(keyForDay(i), pool).id);
    // One full cycle visits every pool member exactly once — no early repeats.
    expect(new Set(cycle).size).toBe(pool.length);
  });

  it('reshuffles at the cycle boundary without throwing', () => {
    const pool = dailyPool();
    const startOfCycle2 = secretFor(keyForDay(pool.length), pool);
    expect(pool).toContain(startOfCycle2);
  });
});
