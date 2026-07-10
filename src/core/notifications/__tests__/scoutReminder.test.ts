/**
 * The 09:00 Scout reminder must skip a day the user has already solved —
 * local notifications can't be conditional at delivery, so syncScoutReminder
 * re-anchors the repeating trigger reactively (launch, solve, toggle), the
 * same model as the streak saver.
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

test('before 09:00 on a day already solved, skips to tomorrow 09:00', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 8, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );

  await syncScoutReminder();

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
});

test('after 09:00, anchors to tomorrow regardless', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 14, 0));
  await AsyncStorage.setItem('app.scoutReminder', 'on');

  await syncScoutReminder();

  expect(scheduledTimestamp()).toBe(new Date(2026, 6, 11, 9, 0).getTime());
});
