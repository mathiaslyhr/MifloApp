/**
 * Guards for the frozen daily schedule (schedule.generated.ts) — the file that
 * keeps the day's secret identical for every user and immune to dataset edits.
 * If coverage runs low or an id goes stale, the fix is `npm run journeyman:schedule`.
 */
import {getById} from '../../../data/football';
import {dateKeyFor, hashDateKey} from '../../scout/dailySeed';
import {DAILY_SECRETS} from '../../scout/schedule.generated';
import {journeymanPool, MIN_CLUB_SPELLS} from '../dailySeed';
import {JOURNEYMAN_SCHEDULE, POOL_SIGNATURE} from '../schedule.generated';

const EPOCH_KEY = '2026-07-01';
const dates = Object.keys(JOURNEYMAN_SCHEDULE);

describe('frozen daily schedule', () => {
  it('was generated against the current pool (else run `npm run journeyman:schedule`)', () => {
    // Normally the pre-commit hook regenerates the schedule whenever the
    // football data changes; this catches anything that slipped past it.
    const live = hashDateKey(
      journeymanPool()
        .map(f => f.id)
        .sort()
        .join('|'),
    );
    expect(POOL_SIGNATURE).toBe(live);
  });

  it('every scheduled id resolves to a footballer with a real career path', () => {
    const stale = dates.filter(d => {
      const f = getById(JOURNEYMAN_SCHEDULE[d]);
      return f === undefined || f.clubs.length < MIN_CLUB_SPELLS;
    });
    expect(stale.map(d => `${d}: ${JOURNEYMAN_SCHEDULE[d]}`)).toEqual([]);
  });

  it('covers every day from the epoch through at least a year from now', () => {
    expect(dates[0]).toBe(EPOCH_KEY);
    // Contiguous: day count matches the span between first and last date.
    const spanDays =
      (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000 + 1;
    expect(dates.length).toBe(spanDays);
    const inAYear = new Date();
    inAYear.setDate(inAYear.getDate() + 365);
    // Run `npm run journeyman:schedule` to extend the horizon when this fails.
    expect(dates[dates.length - 1] >= dateKeyFor(inAYear)).toBe(true);
  });

  it('never repeats a player within a 200-day window', () => {
    const lastSeen = new Map<string, number>();
    const tooSoon: string[] = [];
    dates.forEach((d, i) => {
      const id = JOURNEYMAN_SCHEDULE[d];
      const prev = lastSeen.get(id);
      if (prev !== undefined && i - prev < 200) {
        tooSoon.push(`${id} on ${dates[prev]} and ${d}`);
      }
      lastSeen.set(id, i);
    });
    expect(tooSoon).toEqual([]);
  });

  it("never features Scout's player of the same day", () => {
    const collisions = dates.filter(
      d => DAILY_SECRETS[d] !== undefined && DAILY_SECRETS[d] === JOURNEYMAN_SCHEDULE[d],
    );
    expect(collisions).toEqual([]);
  });
});
