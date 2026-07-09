/**
 * Guards for the frozen daily schedule (schedule.generated.ts) — the file that
 * keeps the day's secret identical for every user and immune to dataset edits.
 * If coverage runs low or an id goes stale, the fix is `npm run scout:schedule`.
 */
import {DAILY_SECRETS} from '../schedule.generated';
import {dailyPool, dailySecretFor, dateKeyFor, secretFor} from '../dailySeed';
import {getById} from '../../../data/football';

const EPOCH_KEY = '2026-01-01';
const dates = Object.keys(DAILY_SECRETS);

describe('frozen daily schedule', () => {
  it('every scheduled id resolves to a real footballer', () => {
    const stale = dates.filter(d => getById(DAILY_SECRETS[d]) === undefined);
    expect(stale.map(d => `${d}: ${DAILY_SECRETS[d]}`)).toEqual([]);
  });

  it('covers every day from the epoch through at least a year from now', () => {
    expect(dates[0]).toBe(EPOCH_KEY);
    // Contiguous: day count matches the span between first and last date.
    const spanDays =
      (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000 + 1;
    expect(dates.length).toBe(spanDays);
    const inAYear = new Date();
    inAYear.setDate(inAYear.getDate() + 365);
    // Run `npm run scout:schedule` to extend the horizon when this fails.
    expect(dates[dates.length - 1] >= dateKeyFor(inAYear)).toBe(true);
  });

  it('never repeats a player within a 250-day window', () => {
    const lastSeen = new Map<string, number>();
    const tooSoon: string[] = [];
    dates.forEach((d, i) => {
      const id = DAILY_SECRETS[d];
      const prev = lastSeen.get(id);
      if (prev !== undefined && i - prev < 250) {
        tooSoon.push(`${id} on ${dates[prev]} and ${d}`);
      }
      lastSeen.set(id, i);
    });
    expect(tooSoon).toEqual([]);
  });

  it('dailySecretFor serves the schedule, falling back to the walk past the horizon', () => {
    const someDay = dates[Math.floor(dates.length / 2)];
    expect(dailySecretFor(someDay).id).toBe(DAILY_SECRETS[someDay]);
    // Far beyond any horizon: deterministic permutation-walk fallback.
    expect(DAILY_SECRETS['2199-06-01']).toBeUndefined();
    expect(dailySecretFor('2199-06-01').id).toBe(
      secretFor('2199-06-01', dailyPool()).id,
    );
  });
});
