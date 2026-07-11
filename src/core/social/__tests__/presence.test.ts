import {ONLINE_WINDOW_MS, presenceFor} from '../presence';

const NOW = Date.parse('2026-07-11T20:00:00Z');

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

describe('presenceFor', () => {
  it('is unknown without a timestamp', () => {
    expect(presenceFor(null, NOW)).toEqual({online: false, minutesAgo: null});
    expect(presenceFor(undefined, NOW)).toEqual({online: false, minutesAgo: null});
    expect(presenceFor('not-a-date', NOW)).toEqual({online: false, minutesAgo: null});
  });

  it('is online inside the window', () => {
    expect(presenceFor(isoMinutesAgo(1), NOW)).toEqual({online: true, minutesAgo: null});
    expect(presenceFor(new Date(NOW - ONLINE_WINDOW_MS).toISOString(), NOW).online).toBe(
      true,
    );
  });

  it('treats a slightly future timestamp (clock skew) as online', () => {
    expect(presenceFor(isoMinutesAgo(-1), NOW).online).toBe(true);
  });

  it('reports whole minutes once offline', () => {
    expect(presenceFor(isoMinutesAgo(14), NOW)).toEqual({online: false, minutesAgo: 14});
    // Just past the window still rounds up to at least one minute.
    const justPast = new Date(NOW - ONLINE_WINDOW_MS - 1_000).toISOString();
    expect(presenceFor(justPast, NOW).minutesAgo).toBeGreaterThanOrEqual(1);
  });
});
