/**
 * Guards for the frozen daily schedule (schedule.generated.ts) — the file that
 * keeps the day's XI identical for every user and immune to data edits. If
 * coverage runs low or an id goes stale, the fix is `npm run teamsheet:schedule`.
 */
import {getLineupById, isTeamsheetLineup} from '../../../data/football';
import {dateKeyFor, hashDateKey} from '../../scout/dailySeed';
import {teamsheetPool} from '../dailySeed';
import {POOL_SIGNATURE, TEAMSHEET_SCHEDULE} from '../schedule.generated';

const EPOCH_KEY = '2026-07-01';
const dates = Object.keys(TEAMSHEET_SCHEDULE);

describe('frozen daily schedule', () => {
  it('was generated against the current pool (else run `npm run teamsheet:schedule`)', () => {
    // Normally the pre-commit hook regenerates the schedule whenever the
    // lineup data changes; this catches anything that slipped past it.
    const live = hashDateKey(
      teamsheetPool()
        .map(l => l.id)
        .sort()
        .join('|'),
    );
    expect(POOL_SIGNATURE).toBe(live);
  });

  it('every scheduled id resolves to an eligible lineup', () => {
    const stale = dates.filter(d => {
      const lineup = getLineupById(TEAMSHEET_SCHEDULE[d]);
      return lineup === undefined || !isTeamsheetLineup(lineup);
    });
    expect(stale.map(d => `${d}: ${TEAMSHEET_SCHEDULE[d]}`)).toEqual([]);
  });

  it('covers every day from the epoch through at least five months from now', () => {
    expect(dates[0]).toBe(EPOCH_KEY);
    // Contiguous: day count matches the span between first and last date.
    const spanDays =
      (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000 + 1;
    expect(dates.length).toBe(spanDays);
    const ahead = new Date();
    ahead.setDate(ahead.getDate() + 150);
    // Run `npm run teamsheet:schedule` to extend the horizon when this fails.
    expect(dates[dates.length - 1] >= dateKeyFor(ahead)).toBe(true);
  });

  it('never repeats a lineup within the no-repeat window', () => {
    // The generator enforces a derived window (~60% of the pool) on the days
    // it writes, but days frozen under an older, smaller pool keep their
    // spacing forever — so the invariant asserted here is a fixed floor the
    // pool has satisfied since it reached 100+ lineups.
    const window = 30;
    const lastSeen = new Map<string, number>();
    const tooSoon: string[] = [];
    dates.forEach((d, i) => {
      const id = TEAMSHEET_SCHEDULE[d];
      const prev = lastSeen.get(id);
      if (prev !== undefined && i - prev <= window) {
        tooSoon.push(`${id} on ${dates[prev]} and ${d}`);
      }
      lastSeen.set(id, i);
    });
    expect(tooSoon).toEqual([]);
  });

  it('never puts the same team, or both benches of one match, on consecutive days', () => {
    const clashes: string[] = [];
    for (let i = 1; i < dates.length; i++) {
      const prev = getLineupById(TEAMSHEET_SCHEDULE[dates[i - 1]])!;
      const curr = getLineupById(TEAMSHEET_SCHEDULE[dates[i]])!;
      if (
        curr.team === prev.team ||
        (curr.year === prev.year && curr.team === prev.match?.opponent)
      ) {
        clashes.push(`${dates[i - 1]} ${prev.id} -> ${dates[i]} ${curr.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
