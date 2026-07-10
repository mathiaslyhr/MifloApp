import {dailyListFor, dailyListIdFor, walkListId} from '../dailyList';
import {getListById, LIST_POOL} from '../lists';
import {TENBALL_SCHEDULE} from '../schedule.generated';

describe('schedule', () => {
  it('every scheduled id resolves to a bundled list', () => {
    for (const [dateKey, listId] of Object.entries(TENBALL_SCHEDULE)) {
      expect({dateKey, ok: getListById(listId) !== undefined}).toEqual({
        dateKey,
        ok: true,
      });
    }
  });

  it('never repeats a list on consecutive days', () => {
    const keys = Object.keys(TENBALL_SCHEDULE).sort();
    for (let i = 1; i < keys.length; i++) {
      expect(TENBALL_SCHEDULE[keys[i]]).not.toBe(TENBALL_SCHEDULE[keys[i - 1]]);
    }
  });

  it('dailyListIdFor prefers the schedule', () => {
    const [dateKey, listId] = Object.entries(TENBALL_SCHEDULE)[0];
    expect(dailyListIdFor(dateKey)).toBe(listId);
    expect(dailyListFor(dateKey).id).toBe(listId);
  });
});

describe('walkListId (beyond the schedule horizon)', () => {
  it('is deterministic for a fixed date', () => {
    expect(walkListId('2030-06-01', LIST_POOL)).toBe(walkListId('2030-06-01', LIST_POOL));
  });

  it('is independent of pool array order', () => {
    const reversed = [...LIST_POOL].reverse();
    expect(walkListId('2030-06-01', reversed)).toBe(walkListId('2030-06-01', LIST_POOL));
  });

  it('walks whole-pool permutations: no repeat within a cycle, all lists used', () => {
    const n = LIST_POOL.length;
    const epoch = Date.UTC(2026, 6, 1); // dailyList EPOCH_KEY
    const seen = new Set<string>();
    const byCycle = new Map<number, Set<string>>();
    for (let i = 0; i < n * 3; i++) {
      const utc = Date.UTC(2031, 0, 1 + i);
      const key = new Date(utc).toISOString().slice(0, 10);
      const cycle = Math.floor((utc - epoch) / 86400000 / n);
      const set = byCycle.get(cycle) ?? new Set<string>();
      const id = walkListId(key, LIST_POOL);
      expect(set.has(id)).toBe(false);
      set.add(id);
      byCycle.set(cycle, set);
      seen.add(id);
    }
    expect(seen.size).toBe(n);
  });
});
