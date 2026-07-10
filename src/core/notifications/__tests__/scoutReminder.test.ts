/**
 * The 09:00 daily reminder must skip a day where EVERY daily game (Scout +
 * Top Bins + Journeyman + Team sheet) is already finished — local
 * notifications can't be conditional at delivery, so syncScoutReminder
 * re-anchors reactively (launch, finish, toggle). The nudge is a rolling
 * window of 14 one-shot triggers, not a repeating one, so a lapsed user goes
 * quiet after two unanswered weeks.
 */
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {disableScoutReminder, syncScoutReminder} from '../scoutReminder';

const create = jest.spyOn(notifee, 'createTriggerNotification');
const cancel = jest.spyOn(notifee, 'cancelTriggerNotification');
const cancelMany = jest.spyOn(notifee, 'cancelTriggerNotifications');

beforeEach(async () => {
  create.mockClear();
  cancel.mockClear();
  cancelMany.mockClear();
  await AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** All scheduled timestamps, in scheduling order (day 0 first). */
function scheduledTimestamps(): number[] {
  expect(create).toHaveBeenCalledTimes(14);
  return create.mock.calls.map(
    call => (call[1] as {timestamp: number}).timestamp,
  );
}

function firstTimestamp(): number {
  return scheduledTimestamps()[0];
}

test('does nothing while the reminder is off', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await syncScoutReminder();
  expect(create).not.toHaveBeenCalled();
});

test('before 09:00 on an unsolved day, anchors to today 09:00', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');

  await syncScoutReminder();

  expect(firstTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
});

test('schedules a 14-day window of one-shot 09:00 triggers, then goes quiet', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');

  await syncScoutReminder();

  const expected = Array.from({length: 14}, (_, day) =>
    new Date(2026, 6, 10 + day, 9, 0).getTime(),
  );
  expect(scheduledTimestamps()).toEqual(expected);
  // One-shot triggers only — a repeating trigger would ping a lapsed user
  // forever.
  for (const call of create.mock.calls) {
    expect(call[1]).not.toHaveProperty('repeatFrequency');
  }
  // The pre-window repeating trigger is still cancelled (devices that
  // scheduled it before the window shipped).
  expect(cancel).toHaveBeenCalledWith('scout-daily');
});

test('re-syncing reuses the same ids so the window never grows', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');

  await syncScoutReminder();
  await syncScoutReminder();

  const ids = create.mock.calls.map(
    call => (call[0] as {id: string}).id,
  );
  expect(new Set(ids).size).toBe(14);
});

test('disabling cancels the whole window plus the legacy repeating id', async () => {
  await AsyncStorage.setItem('app.scoutReminder', 'on');

  await disableScoutReminder();

  expect(cancelMany).toHaveBeenCalledTimes(1);
  const cancelled = cancelMany.mock.calls[0][0] as string[];
  expect(cancelled).toHaveLength(15);
  expect(cancelled).toContain('scout-daily');
  expect(cancelled).toContain('scout-daily-0');
  expect(cancelled).toContain('scout-daily-13');
  expect(await AsyncStorage.getItem('app.scoutReminder')).toBe('off');
});

test('before 09:00 with only Scout solved, still anchors to today (Top Bins is waiting)', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );

  await syncScoutReminder();

  expect(firstTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
});

test('before 09:00 with every daily game finished, skips to tomorrow 09:00', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );
  await AsyncStorage.setItem(
    'tenball.progress',
    JSON.stringify({
      dateKey: '2026-07-10',
      listId: 'l',
      guesses: Array.from({length: 10}, (_, i) => ({text: `p${i}`, rank: i + 1})),
      gaveUp: false,
    }),
  );
  await AsyncStorage.setItem(
    'journeyman.progress',
    JSON.stringify({
      dateKey: '2026-07-10',
      secretId: 'X',
      guessedIds: ['X'],
      gaveUp: false,
    }),
  );
  await AsyncStorage.setItem(
    'teamsheet.progress',
    JSON.stringify({
      dateKey: '2026-07-10',
      lineupId: 'xi',
      guesses: Array.from({length: 11}, (_, i) => ({text: `p${i}`, slot: i})),
      gaveUp: false,
    }),
  );

  await syncScoutReminder();

  expect(firstTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
});

test('given-up Top Bins, Journeyman and Team sheet days count as finished for the skip', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
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

  await syncScoutReminder();

  expect(firstTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
});

test('before 09:00 with only Team sheet waiting, still anchors to today', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );
  await AsyncStorage.setItem(
    'tenball.progress',
    JSON.stringify({dateKey: '2026-07-10', listId: 'l', guesses: [], gaveUp: true}),
  );
  await AsyncStorage.setItem(
    'journeyman.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: [], gaveUp: true}),
  );

  await syncScoutReminder();

  expect(firstTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
});

test('before 09:00 with only Journeyman waiting, still anchors to today', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );
  await AsyncStorage.setItem(
    'tenball.progress',
    JSON.stringify({dateKey: '2026-07-10', listId: 'l', guesses: [], gaveUp: true}),
  );

  await syncScoutReminder();

  expect(firstTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
});

test('after 09:00, anchors to tomorrow regardless', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 14, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');

  await syncScoutReminder();

  expect(firstTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
});
