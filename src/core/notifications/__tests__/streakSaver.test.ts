/**
 * The 20:00 streak saver is ONE notification however many daily-game streaks
 * are at risk tonight: the game's own copy when it's a single streak, the
 * combined "streaks on the line" copy when several are. At risk = a live
 * streak (yesterday completed) that today hasn't extended. Synced reactively
 * (launch, finish, toggle) because local notifications can't be conditional
 * at delivery time.
 */
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {syncStreakSaver} from '../streakSaver';

const create = jest.spyOn(notifee, 'createTriggerNotification');
const cancelMany = jest.spyOn(notifee, 'cancelTriggerNotifications');

beforeEach(async () => {
  create.mockClear();
  cancelMany.mockClear();
  await AsyncStorage.clear();
  jest.useFakeTimers();
  // Mid-morning on 2026-07-10 — before tonight's 20:00 slot.
  jest.setSystemTime(new Date(2026, 6, 10, 10, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

function reminderOn(): Promise<void> {
  return AsyncStorage.setItem('app.scoutReminder', 'on');
}

function liveStreak(prefix: string, days: number): Promise<void> {
  return AsyncStorage.setItem(
    `${prefix}.streak`,
    JSON.stringify({current: days, best: days, lastCompletedDateKey: '2026-07-09'}),
  );
}

function scheduled(): {id: string; title: string; body: string; timestamp: number} {
  expect(create).toHaveBeenCalledTimes(1);
  const [notification, trigger] = create.mock.calls[0] as [
    {id: string; title: string; body: string},
    {timestamp: number},
  ];
  return {...notification, timestamp: trigger.timestamp};
}

test('while the reminder is off, cancels everything and schedules nothing', async () => {
  await liveStreak('mystery', 5);

  await syncStreakSaver();

  expect(create).not.toHaveBeenCalled();
  expect(cancelMany).toHaveBeenCalledWith([
    'streak-saver',
    'scout-streak',
    'tenball-streak',
    'journeyman-streak',
    'teamsheet-streak',
  ]);
});

test('one at-risk streak schedules a single 20:00 nudge with that game\'s copy', async () => {
  await reminderOn();
  await liveStreak('mystery', 5);

  await syncStreakSaver();

  const nudge = scheduled();
  expect(nudge.id).toBe('streak-saver');
  expect(nudge.body).toBe('Your 5-day Scout streak is on the line.');
  expect(nudge.timestamp).toBe(new Date(2026, 6, 10, 20, 0).getTime());
});

test('a non-Scout single streak uses its own game\'s copy', async () => {
  await reminderOn();
  await liveStreak('journeyman', 3);

  await syncStreakSaver();

  expect(scheduled().body).toBe('Your 3-day Journeyman streak is on the line.');
});

test('several at-risk streaks coalesce into one combined nudge', async () => {
  await reminderOn();
  await liveStreak('mystery', 5);
  await liveStreak('tenball', 12);
  await liveStreak('teamsheet', 2);

  await syncStreakSaver();

  const nudge = scheduled();
  expect(nudge.body).toBe('You have 3 streaks on the line.');
  expect(nudge.timestamp).toBe(new Date(2026, 6, 10, 20, 0).getTime());
});

test('the legacy per-game ids are cancelled even when tonight gets a nudge', async () => {
  await reminderOn();
  await liveStreak('mystery', 5);

  await syncStreakSaver();

  expect(cancelMany).toHaveBeenCalledWith([
    'scout-streak',
    'tenball-streak',
    'journeyman-streak',
    'teamsheet-streak',
  ]);
});

test('a streak already extended today is not at risk', async () => {
  await reminderOn();
  await liveStreak('mystery', 5);
  await AsyncStorage.setItem(
    'mystery.progress',
    JSON.stringify({dateKey: '2026-07-10', secretId: 'X', guessedIds: ['X']}),
  );

  await syncStreakSaver();

  expect(create).not.toHaveBeenCalled();
  expect(cancelMany).toHaveBeenCalled();
});

test('a streak that already lapsed before yesterday is not at risk', async () => {
  await reminderOn();
  await AsyncStorage.setItem(
    'mystery.streak',
    JSON.stringify({current: 5, best: 5, lastCompletedDateKey: '2026-07-07'}),
  );

  await syncStreakSaver();

  expect(create).not.toHaveBeenCalled();
});

test('past 20:00 tonight is left alone', async () => {
  jest.setSystemTime(new Date(2026, 6, 10, 21, 0));
  await reminderOn();
  await liveStreak('mystery', 5);

  await syncStreakSaver();

  expect(create).not.toHaveBeenCalled();
  expect(cancelMany).toHaveBeenCalled();
});
