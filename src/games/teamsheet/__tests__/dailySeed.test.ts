import {dailyLineupFor, dailyLineupIdFor, teamsheetPool, walkLineupId} from '../dailySeed';
import {TEAMSHEET_SCHEDULE} from '../schedule.generated';

const POOL = teamsheetPool();

describe('schedule', () => {
  it('dailyLineupIdFor prefers the schedule', () => {
    const [dateKey, lineupId] = Object.entries(TEAMSHEET_SCHEDULE)[0];
    expect(dailyLineupIdFor(dateKey)).toBe(lineupId);
    expect(dailyLineupFor(dateKey).id).toBe(lineupId);
  });

  it('resolves a lineup for a date beyond the horizon', () => {
    const lineup = dailyLineupFor('2031-06-01');
    expect(POOL.some(l => l.id === lineup.id)).toBe(true);
  });
});

describe('walkLineupId (beyond the schedule horizon)', () => {
  it('is deterministic for a fixed date', () => {
    expect(walkLineupId('2031-06-01', POOL)).toBe(walkLineupId('2031-06-01', POOL));
  });

  it('is independent of pool array order', () => {
    const reversed = [...POOL].reverse();
    expect(walkLineupId('2031-06-01', reversed)).toBe(walkLineupId('2031-06-01', POOL));
  });

  it('walks whole-pool permutations: no repeat within a cycle, all lineups used', () => {
    const n = POOL.length;
    const epoch = Date.UTC(2026, 6, 1); // dailySeed EPOCH_KEY
    const seen = new Set<string>();
    const byCycle = new Map<number, Set<string>>();
    for (let i = 0; i < n * 3; i++) {
      const utc = Date.UTC(2031, 0, 1 + i);
      const key = new Date(utc).toISOString().slice(0, 10);
      const cycle = Math.floor((utc - epoch) / 86400000 / n);
      const set = byCycle.get(cycle) ?? new Set<string>();
      const id = walkLineupId(key, POOL);
      expect(set.has(id)).toBe(false);
      set.add(id);
      byCycle.set(cycle, set);
      seen.add(id);
    }
    expect(seen.size).toBe(n);
  });
});
