/**
 * The 09:00 daily reminder must skip a day where EVERY daily game (Scout +
 * Top Bins + Journeyman + Team sheet) is already finished — local
 * notifications can't be conditional at delivery, so syncScoutReminder
 * re-anchors the repeating trigger reactively (launch, finish, toggle), the
 * same model as the streak savers.
 */
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {syncScoutReminder} from '../scoutReminder';

const create = jest.spyOn(notifee, 'createTriggerNotification');

beforeEach(async () => {
  create.mockClear();
  await AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function scheduledTimestamp(): number {
  expect(create).toHaveBeenCalledTimes(1);
  const trigger = create.mock.calls[0][1] as {timestamp: number};
  return trigger.timestamp;
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

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
});

test('before 09:00 with only Scout solved, still anchors to today (Top Bins is waiting)', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );

  await syncScoutReminder();

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
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

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
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

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
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

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
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

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 10, 9, 0).getTime());
});

test('after 09:00, anchors to tomorrow regardless', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 14, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');

  await syncScoutReminder();

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
});
