/**
 * The scheduler end to end: real storage, real i18n, notifee spied on. The
 * planner's rules are unit-tested in nudgePlan.test.ts; this covers the wiring
 * (state in, sentences out) and the compatibility guarantees that keep an
 * upgrade from stranding a pending trigger on someone's phone.
 */
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {disableScoutReminder, syncNudges} from '../scoutReminder';

const create = jest.spyOn(notifee, 'createTriggerNotification');
const cancel = jest.spyOn(notifee, 'cancelTriggerNotification');
const cancelMany = jest.spyOn(notifee, 'cancelTriggerNotifications');

beforeEach(async () => {
  create.mockClear();
  cancel.mockClear();
  cancelMany.mockClear();
  await AsyncStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

function reminderOn(): Promise<void> {
  return AsyncStorage.setItem('app.scoutReminder', 'on');
}

/** A streak completed yesterday and not yet extended today. */
function liveStreak(prefix: string, days: number): Promise<void> {
  return AsyncStorage.setItem(
    `${prefix}.streak`,
    JSON.stringify({current: days, best: days, lastCompletedDateKey: '2026-07-09'}),
  );
}

function solvedScout(): Promise<void> {
  return AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );
}

type Scheduled = {id: string; title: string; body: string; timestamp: number};

function scheduled(): Scheduled[] {
  return create.mock.calls.map(call => {
    const [notification, trigger] = call as unknown as [
      {id: string; title: string; body: string},
      {timestamp: number},
    ];
    return {...notification, timestamp: trigger.timestamp};
  });
}

function windowNudges(): Scheduled[] {
  return scheduled().filter(n => n.id.startsWith('scout-daily-'));
}

function evening(): Scheduled | undefined {
  return scheduled().find(n => n.id === 'streak-saver');
}

test('does nothing but tidy up while the reminder is off', async () => {
  await syncNudges();

  expect(create).not.toHaveBeenCalled();
  const cancelled = cancelMany.mock.calls[0][0] as string[];
  expect(cancelled).toEqual(
    expect.arrayContaining(['scout-daily', 'scout-daily-0', 'streak-saver']),
  );
});

describe('the window', () => {
  test('is 14 one-shots, anchored to 09:00 before any habit is known', async () => {
    await reminderOn();

    await syncNudges();

    expect(windowNudges().map(n => n.timestamp)).toEqual(
      Array.from({length: 14}, (_, day) =>
        new Date(2026, 6, 10 + day, 9, 0).getTime(),
      ),
    );
    // A repeating trigger would ping a lapsed user forever.
    for (const call of create.mock.calls) {
      expect(call[1]).not.toHaveProperty('repeatFrequency');
    }
  });

  test('follows the learned habit once one exists', async () => {
    await reminderOn();
    await AsyncStorage.setItem('app.habitSessions', JSON.stringify([17 * 60]));

    await syncNudges();

    // A 17:00 habit is pinged 30 minutes early.
    expect(windowNudges().map(n => n.timestamp)).toEqual(
      Array.from({length: 14}, (_, day) =>
        new Date(2026, 6, 10 + day, 16, 30).getTime(),
      ),
    );
  });

  test('re-syncing reuses the same ids so the window never grows', async () => {
    await reminderOn();

    await syncNudges();
    await syncNudges();

    const ids = windowNudges().map(n => n.id);
    expect(new Set(ids).size).toBe(14);
  });

  test('varies its copy rather than repeating one sentence for two weeks', async () => {
    await reminderOn();

    await syncNudges();

    expect(new Set(windowNudges().map(n => n.body)).size).toBeGreaterThan(1);
  });

  test('cancels the legacy repeating trigger from before the window shipped', async () => {
    await reminderOn();

    await syncNudges();

    expect(cancelMany).toHaveBeenCalledWith([
      'scout-daily',
      'scout-streak',
      'tenball-streak',
      'journeyman-streak',
      'teamsheet-streak',
    ]);
  });

  test('skips to tomorrow when every daily is finished', async () => {
    await reminderOn();
    await solvedScout();
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: '2026-07-10', listId: 'l', guesses: [], gaveUp: true}),
    );
    await AsyncStorage.setItem(
      'journeyman.progress',
      JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: [], gaveUp: true}),
    );
    await AsyncStorage.setItem(
      'teamsheet.progress',
      JSON.stringify({dateKey: '2026-07-10', lineupId: 'xi', guesses: [], gaveUp: true}),
    );

    await syncNudges();

    expect(windowNudges()[0].timestamp).toBe(new Date(2026, 6, 11, 9, 0).getTime());
  });

  // Regression: Scout was the only game whose surrender didn't count, so a
  // surrendered Scout kept the window anchored on today.
  test('counts a surrendered Scout as finished', async () => {
    await reminderOn();
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['A'], gaveUp: true}),
    );
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: '2026-07-10', listId: 'l', guesses: [], gaveUp: true}),
    );
    await AsyncStorage.setItem(
      'journeyman.progress',
      JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: [], gaveUp: true}),
    );
    await AsyncStorage.setItem(
      'teamsheet.progress',
      JSON.stringify({dateKey: '2026-07-10', lineupId: 'xi', guesses: [], gaveUp: true}),
    );

    await syncNudges();

    expect(windowNudges()[0].timestamp).toBe(new Date(2026, 6, 11, 9, 0).getTime());
  });

  test('still anchors to today while any daily is waiting', async () => {
    await reminderOn();
    await solvedScout();

    await syncNudges();

    expect(windowNudges()[0].timestamp).toBe(new Date(2026, 6, 10, 9, 0).getTime());
  });
});

describe('the evening', () => {
  test('leads with the number, not the game, for one at-risk streak', async () => {
    await reminderOn();
    await liveStreak('mystery', 47);

    await syncNudges();

    expect(evening()).toMatchObject({
      id: 'streak-saver',
      title: 'Miflo',
      body: 'Last call. Your 47-day streak ends at midnight.',
      timestamp: new Date(2026, 6, 10, 20, 0).getTime(),
    });
  });

  test("takes over today's habit nudge too, so both say the same thing", async () => {
    await reminderOn();
    await liveStreak('mystery', 47);

    await syncNudges();

    expect(windowNudges()[0].body).toBe('Your 47-day streak is on the line.');
  });

  test('coalesces several at-risk streaks into one count', async () => {
    await reminderOn();
    await liveStreak('mystery', 5);
    await liveStreak('tenball', 12);
    await liveStreak('teamsheet', 2);

    await syncNudges();

    expect(evening()!.body).toBe('Last call. 3 streaks end at midnight.');
  });

  test('taunts a puzzle that was started and abandoned', async () => {
    await reminderOn();
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['A']}),
    );

    await syncNudges();

    expect(evening()!.body).toBe('Scout is still unsolved. Was it that hard?');
  });

  test('names the right game when it is not Scout', async () => {
    await reminderOn();
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: '2026-07-10', listId: 'l', guesses: [{text: 'a'}], gaveUp: false}),
    );

    await syncNudges();

    expect(evening()!.body).toBe('Top Bins is still unsolved. Was it that hard?');
  });

  test('counts them when several were abandoned', async () => {
    await reminderOn();
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['A']}),
    );
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: '2026-07-10', listId: 'l', guesses: [{text: 'a'}], gaveUp: false}),
    );

    await syncNudges();

    expect(evening()!.body).toBe(
      '2 puzzles are still unsolved. Were they that hard?',
    );
  });

  // "Was it that hard?" is a bluff against someone who never opened it.
  test('stays silent, and cancels, on a day nobody touched', async () => {
    await reminderOn();

    await syncNudges();

    expect(evening()).toBeUndefined();
    expect(cancel).toHaveBeenCalledWith('streak-saver');
  });

  test('is not triggered by a streak already extended today', async () => {
    await reminderOn();
    await liveStreak('mystery', 5);
    await solvedScout();

    await syncNudges();

    expect(evening()).toBeUndefined();
  });

  test('is not triggered by a streak that already lapsed before yesterday', async () => {
    await reminderOn();
    await AsyncStorage.setItem(
      'mystery.streak',
      JSON.stringify({current: 5, best: 5, lastCompletedDateKey: '2026-07-07'}),
    );

    await syncNudges();

    expect(evening()).toBeUndefined();
  });

  test('is left alone once 20:00 has passed', async () => {
    jest.setSystemTime(new Date(2026, 6, 10, 21, 0));
    await reminderOn();
    await liveStreak('mystery', 5);

    await syncNudges();

    expect(evening()).toBeUndefined();
    expect(cancel).toHaveBeenCalledWith('streak-saver');
  });
});

describe('the fire ledger', () => {
  test('records every timestamp a sync scheduled', async () => {
    await reminderOn();
    await liveStreak('mystery', 5);

    await syncNudges();

    const ledger = JSON.parse(
      (await AsyncStorage.getItem('app.nudgeFireAts')) ?? '[]',
    );
    expect(ledger).toEqual(
      [...windowNudges(), evening()!].map(n => n.timestamp).sort((a, b) => a - b),
    );
  });
});

test('disabling cancels every id this app has ever scheduled', async () => {
  await reminderOn();

  await disableScoutReminder();

  const cancelled = cancelMany.mock.calls[0][0] as string[];
  expect(cancelled).toHaveLength(20);
  expect(cancelled).toEqual(
    expect.arrayContaining([
      'scout-daily',
      'scout-daily-0',
      'scout-daily-13',
      'streak-saver',
      'scout-streak',
      'teamsheet-streak',
    ]),
  );
  expect(await AsyncStorage.getItem('app.scoutReminder')).toBe('off');
});
