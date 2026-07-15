/**
 * The habit anchor is the whole point of the retimed nudge: ping ~23.5h after
 * a session, because that was the moment yesterday when the user demonstrably
 * had time. Two things protect the signal.
 *
 * A session we caused by pinging proves nothing about when someone is free, so
 * it must not move the anchor. Without that rule the slot walks 30 minutes
 * earlier every day and a 20:00 player ends up being pinged at breakfast.
 *
 * The anchor is a median rather than the last session, so one late-night browse
 * cannot yank a morning player's slot into the evening.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  anchorMinutesFrom,
  isOrganicSession,
  loadHabitSlotMinutes,
  mergeFireAts,
  recordSession,
  rememberNudgeFires,
  ORGANIC_GRACE_MS,
  HABIT_SAMPLES,
} from '../habit';

/** Same clock time, `days` later. */
function onDay(days: number, hour: number, minute = 0): number {
  return new Date(2026, 6, 10 + days, hour, minute).getTime();
}

const MIN = 60_000;
const HOUR = 60 * MIN;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 6, 10, 10, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

function at(hour: number, minute = 0): number {
  return new Date(2026, 6, 10, hour, minute).getTime();
}

async function storedSamples(): Promise<number[]> {
  return JSON.parse((await AsyncStorage.getItem('app.habitSessions')) ?? '[]');
}

describe('isOrganicSession', () => {
  const fire = at(9, 0);

  test('a session moments after a nudge fired was caused by us', () => {
    expect(isOrganicSession(at(9, 10), [fire])).toBe(false);
  });

  test('a session long after a nudge fired is the user, not us', () => {
    expect(isOrganicSession(at(9, 50), [fire])).toBe(true);
  });

  test('a session before the nudge fired cannot have been caused by it', () => {
    expect(isOrganicSession(at(8, 55), [fire])).toBe(true);
  });

  test('a nudge still in the future never suppresses', () => {
    expect(isOrganicSession(at(10, 0), [at(14, 0)])).toBe(true);
  });

  test('with no nudges on record, everything is organic', () => {
    expect(isOrganicSession(at(10, 0), [])).toBe(true);
  });

  test('the grace boundary is exclusive', () => {
    expect(isOrganicSession(fire + ORGANIC_GRACE_MS, [fire])).toBe(true);
    expect(isOrganicSession(fire + ORGANIC_GRACE_MS - 1, [fire])).toBe(false);
  });
});

describe('anchorMinutesFrom', () => {
  test('is unknown until a session is recorded', () => {
    expect(anchorMinutesFrom([])).toBeNull();
  });

  test('takes the median, so one outlier cannot move it', () => {
    expect(anchorMinutesFrom([540, 540, 540, 540, 1260])).toBe(540);
  });

  test('follows a genuinely shifted routine', () => {
    expect(anchorMinutesFrom([540, 540, 1260, 1260, 1260])).toBe(1260);
  });
});

describe('mergeFireAts', () => {
  const now = at(10, 0);

  test('keeps recent past fires, which is what the grace check reads', () => {
    expect(mergeFireAts([at(9, 30)], [], now)).toEqual([at(9, 30)]);
  });

  test('drops fires older than a day', () => {
    expect(mergeFireAts([now - 25 * HOUR], [], now)).toEqual([]);
  });

  // A future entry from a previous sync was overwritten by this one's upsert,
  // so it will never fire and must not suppress a session.
  test('drops stale futures that this sync did not re-plan', () => {
    expect(mergeFireAts([at(14, 0)], [at(16, 0)], now)).toEqual([at(16, 0)]);
  });

  test('merges without duplicating and stays sorted', () => {
    expect(mergeFireAts([at(9, 30)], [at(16, 0), at(9, 30)], now)).toEqual([
      at(9, 30),
      at(16, 0),
    ]);
  });
});

describe('recordSession', () => {
  test('a first session sets the anchor', async () => {
    await recordSession(at(17, 0));

    expect(await storedSamples()).toEqual([17 * 60]);
    expect(await loadHabitSlotMinutes()).toBe(16 * 60 + 30);
  });

  test('with nothing recorded, the slot is the 09:00 the app already ships', async () => {
    expect(await loadHabitSlotMinutes()).toBe(9 * 60);
  });

  // The regression that matters: without this the slot walks earlier daily.
  test('a session we pinged into existence does not move the anchor', async () => {
    await AsyncStorage.setItem('app.habitSessions', JSON.stringify([17 * 60]));
    await rememberNudgeFires([at(16, 30)]);

    const moved = await recordSession(at(16, 40));

    expect(moved).toBe(false);
    expect(await storedSamples()).toEqual([17 * 60]);
    expect(await loadHabitSlotMinutes()).toBe(16 * 60 + 30);
  });

  test('an organic session well clear of the nudge does move it', async () => {
    await AsyncStorage.setItem('app.habitSessions', JSON.stringify([17 * 60]));
    await rememberNudgeFires([at(16, 30)]);

    const moved = await recordSession(at(19, 0));

    expect(moved).toBe(true);
    expect(await storedSamples()).toEqual([17 * 60, 19 * 60]);
  });

  test('only the first session of a day is sampled', async () => {
    await recordSession(at(9, 0));

    const moved = await recordSession(at(17, 0));

    expect(moved).toBe(false);
    expect(await storedSamples()).toEqual([9 * 60]);
  });

  test('the next day samples again', async () => {
    await recordSession(onDay(0, 9, 0));

    await recordSession(onDay(1, 10, 0));

    expect(await storedSamples()).toEqual([9 * 60, 10 * 60]);
  });

  // Otherwise a 09:00 player who answers our 08:30 ping and later browses at
  // 20:00 gets sampled at 20:00, and the slot walks into the evening.
  test('a day opened by our ping is consumed, not resampled later', async () => {
    await rememberNudgeFires([at(8, 30)]);

    await recordSession(at(8, 35));
    await recordSession(at(20, 0));

    expect(await storedSamples()).toEqual([]);
  });

  test('keeps only the most recent samples', async () => {
    for (let i = 0; i < HABIT_SAMPLES + 2; i++) {
      await recordSession(onDay(i, 9 + i, 0));
    }

    const samples = await storedSamples();
    expect(samples).toHaveLength(HABIT_SAMPLES);
    expect(samples[samples.length - 1]).toBe((9 + HABIT_SAMPLES + 1) * 60);
  });

  // The reason the median exists: a morning player who browses once at night
  // must keep their 09:00.
  test('one late browse does not cost a morning player their 09:00', async () => {
    await AsyncStorage.setItem(
      'app.habitSessions',
      JSON.stringify([9 * 60, 9 * 60, 9 * 60, 9 * 60]),
    );

    await recordSession(at(21, 0));

    expect(await loadHabitSlotMinutes()).toBe(9 * 60);
  });

  // The reason one-sample-a-day exists: without it, a single restless day fills
  // every slot and outvotes a week of mornings.
  test('a sick day spent opening the app hourly costs at most one sample', async () => {
    await AsyncStorage.setItem(
      'app.habitSessions',
      JSON.stringify([9 * 60, 9 * 60, 9 * 60, 9 * 60]),
    );

    for (const hour of [11, 13, 15, 17, 19]) {
      await recordSession(at(hour, 0));
    }

    expect(await storedSamples()).toEqual([9 * 60, 9 * 60, 9 * 60, 9 * 60, 11 * 60]);
    expect(await loadHabitSlotMinutes()).toBe(9 * 60);
  });
});
