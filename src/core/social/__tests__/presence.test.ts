import {
  MAX_ACTIVE_AGE_MIN,
  ONLINE_WINDOW_MS,
  lastActiveParts,
  presenceFor,
} from '../presence';

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

describe('lastActiveParts', () => {
  const offline = (minutesAgo: number) => ({online: false, minutesAgo});

  it('says nothing when online or unknown — the dot speaks instead', () => {
    expect(lastActiveParts({online: true, minutesAgo: null})).toBeNull();
    expect(lastActiveParts({online: false, minutesAgo: null})).toBeNull();
  });

  it('reads minutes under the hour', () => {
    expect(lastActiveParts(offline(1))).toEqual({value: 1, unit: 'minutes'});
    expect(lastActiveParts(offline(59))).toEqual({value: 59, unit: 'minutes'});
  });

  it('turns over to hours at 60, and to days at 24 hours', () => {
    expect(lastActiveParts(offline(60))).toEqual({value: 1, unit: 'hours'});
    expect(lastActiveParts(offline(24 * 60 - 1))).toEqual({value: 23, unit: 'hours'});
    expect(lastActiveParts(offline(24 * 60))).toEqual({value: 1, unit: 'days'});
  });

  it('floors rather than rounds, so 119 minutes is 1 hour and not 2', () => {
    expect(lastActiveParts(offline(119))).toEqual({value: 1, unit: 'hours'});
  });

  it('freezes at two weeks instead of counting up forever', () => {
    expect(lastActiveParts(offline(MAX_ACTIVE_AGE_MIN))).toEqual({value: 14, unit: 'days'});
    expect(lastActiveParts(offline(MAX_ACTIVE_AGE_MIN * 10))).toEqual({value: 14, unit: 'days'});
  });
});
