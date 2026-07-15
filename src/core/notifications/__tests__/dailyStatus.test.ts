/**
 * The notification layer's one view of the daily games. Both halves of a nudge
 * decision read from here, so the "finished" and "started" rules have to agree
 * across all four games: a surrender counts as finished (there is nothing left
 * to nudge about), and "started" means a real guess was made, not merely that
 * the screen was opened.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {loadDailyStatuses, type DailyGameStatus} from '../dailyStatus';

const TODAY = '2026-07-10';

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function statusFor(game: DailyGameStatus['game']): Promise<DailyGameStatus> {
  const statuses = await loadDailyStatuses(TODAY);
  return statuses.find(s => s.game === game)!;
}

test('a fresh day is neither started nor finished for any game', async () => {
  const statuses = await loadDailyStatuses(TODAY);

  expect(statuses).toHaveLength(4);
  for (const status of statuses) {
    expect(status).toMatchObject({startedToday: false, finishedToday: false});
  }
});

describe('finishedToday', () => {
  test('a solved Scout is finished', async () => {
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: TODAY, secretId: 'X', guessedIds: ['A', 'X']}),
    );

    expect(await statusFor('scout')).toMatchObject({finishedToday: true});
  });

  // The bug: Scout was the only game missing the gaveUp check the other three
  // have, so a surrender read as unfinished and kept nudging all day.
  test('a surrendered Scout is finished', async () => {
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: TODAY, secretId: 'X', guessedIds: ['A'], gaveUp: true}),
    );

    expect(await statusFor('scout')).toMatchObject({finishedToday: true});
  });

  test('an unsolved Scout with guesses is started but not finished', async () => {
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: TODAY, secretId: 'X', guessedIds: ['A']}),
    );

    expect(await statusFor('scout')).toMatchObject({
      startedToday: true,
      finishedToday: false,
    });
  });

  test('a surrendered Journeyman, Top Bins and Team sheet are finished', async () => {
    await AsyncStorage.setItem(
      'journeyman.progress',
      JSON.stringify({dateKey: TODAY, secretId: 'X', guessedIds: [], gaveUp: true}),
    );
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: TODAY, listId: 'l', guesses: [], gaveUp: true}),
    );
    await AsyncStorage.setItem(
      'teamsheet.progress',
      JSON.stringify({dateKey: TODAY, lineupId: 'xi', guesses: [], gaveUp: true}),
    );

    expect(await statusFor('journeyman')).toMatchObject({finishedToday: true});
    expect(await statusFor('tenball')).toMatchObject({finishedToday: true});
    expect(await statusFor('teamsheet')).toMatchObject({finishedToday: true});
  });

  test('a full Top Bins board is finished, a partial one is not', async () => {
    const guesses = (n: number) =>
      Array.from({length: n}, (_, i) => ({text: `p${i}`, rank: i + 1}));
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: TODAY, listId: 'l', guesses: guesses(9), gaveUp: false}),
    );
    expect(await statusFor('tenball')).toMatchObject({finishedToday: false});

    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: TODAY, listId: 'l', guesses: guesses(10), gaveUp: false}),
    );
    expect(await statusFor('tenball')).toMatchObject({finishedToday: true});
  });

  test("yesterday's progress does not count as today", async () => {
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: '2026-07-09', secretId: 'X', guessedIds: ['X']}),
    );

    expect(await statusFor('scout')).toMatchObject({
      startedToday: false,
      finishedToday: false,
    });
  });
});

describe('startedToday', () => {
  test('a wrong guess counts as started for every game', async () => {
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: TODAY, secretId: 'X', guessedIds: ['A']}),
    );
    await AsyncStorage.setItem(
      'journeyman.progress',
      JSON.stringify({dateKey: TODAY, secretId: 'X', guessedIds: ['A'], gaveUp: false}),
    );
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({
        dateKey: TODAY,
        listId: 'l',
        guesses: [{text: 'a'}],
        gaveUp: false,
      }),
    );
    await AsyncStorage.setItem(
      'teamsheet.progress',
      JSON.stringify({
        dateKey: TODAY,
        lineupId: 'xi',
        guesses: [{text: 'a'}],
        gaveUp: false,
      }),
    );

    for (const status of await loadDailyStatuses(TODAY)) {
      expect(status.startedToday).toBe(true);
    }
  });

  // The taunt ("was it that hard?") is a bluff unless a guess was actually
  // made, so an empty progress row must not count.
  test('an opened but unguessed board is not started', async () => {
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: TODAY, secretId: 'X', guessedIds: []}),
    );
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: TODAY, listId: 'l', guesses: [], gaveUp: false}),
    );

    expect(await statusFor('scout')).toMatchObject({startedToday: false});
    expect(await statusFor('tenball')).toMatchObject({startedToday: false});
  });
});

test('streak days and last-completed come through per game', async () => {
  await AsyncStorage.setItem(
    'mystery.streak',
    JSON.stringify({current: 47, best: 50, lastCompletedDateKey: '2026-07-09'}),
  );

  expect(await statusFor('scout')).toMatchObject({
    streakDays: 47,
    streakLastCompleted: '2026-07-09',
  });
  expect(await statusFor('tenball')).toMatchObject({
    streakDays: 0,
    streakLastCompleted: null,
  });
});
