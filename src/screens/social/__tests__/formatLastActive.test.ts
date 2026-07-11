import {formatLastActive} from '../PersonCard';
import type {Presence} from '../../../core/social/presence';

// A stub translator that echoes the key + count, so we assert the tier and
// number without depending on the real copy.
const t = ((key: string, opts?: {count?: number}) =>
  `${key}:${opts?.count}`) as unknown as Parameters<typeof formatLastActive>[1];

function at(minutesAgo: number | null, online = false): Presence {
  return {online, minutesAgo};
}

describe('formatLastActive', () => {
  it('shows nothing when online or unknown', () => {
    expect(formatLastActive(at(5, true), t)).toBeNull();
    expect(formatLastActive(at(null), t)).toBeNull();
  });

  it('reports minutes under an hour', () => {
    expect(formatLastActive(at(1), t)).toBe('social.activeMinutes:1');
    expect(formatLastActive(at(59), t)).toBe('social.activeMinutes:59');
  });

  it('reports 1-23 whole hours', () => {
    expect(formatLastActive(at(60), t)).toBe('social.activeHours:1');
    expect(formatLastActive(at(23 * 60 + 59), t)).toBe('social.activeHours:23');
  });

  it('switches to days at 24 hours', () => {
    expect(formatLastActive(at(24 * 60), t)).toBe('social.activeDays:1');
    expect(formatLastActive(at(13 * 24 * 60), t)).toBe('social.activeDays:13');
  });

  it('freezes at 14 days (2 weeks) and stops counting up', () => {
    expect(formatLastActive(at(14 * 24 * 60), t)).toBe('social.activeDays:14');
    // A friend last seen a year ago still reads "14 days", never more.
    expect(formatLastActive(at(365 * 24 * 60), t)).toBe('social.activeDays:14');
  });
});
