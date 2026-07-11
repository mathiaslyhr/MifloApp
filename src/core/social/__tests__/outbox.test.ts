import AsyncStorage from '@react-native-async-storage/async-storage';
import {flushOutbox, queueDailyResult, runBackfill, upsertEntries} from '../outbox';
import {getCachedProfile, publishResults} from '../socialService';
import type {PublishedResult} from '../types';

jest.mock('../socialService', () => ({
  getCachedProfile: jest.fn(),
  publishResults: jest.fn(),
}));

const mockGetCachedProfile = getCachedProfile as jest.Mock;
const mockPublishResults = publishResults as jest.Mock;

const PROFILE = {userId: 'u1', displayName: 'Mathias', friendCode: 'AB12CD'};
const TODAY = '2026-07-11';

function result(overrides: Partial<PublishedResult> = {}): PublishedResult {
  return {
    dateKey: TODAY,
    game: 'scout',
    status: 'won',
    score: 4,
    total: null,
    streak: 2,
    ...overrides,
  };
}

async function readQueue(): Promise<PublishedResult[]> {
  const raw = await AsyncStorage.getItem('social.outbox');
  return raw ? JSON.parse(raw) : [];
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetCachedProfile.mockReset().mockResolvedValue(null);
  mockPublishResults.mockReset().mockResolvedValue(undefined);
});

describe('upsertEntries', () => {
  it('replaces an entry for the same game and day', () => {
    const queue = upsertEntries(
      [result({score: 4})],
      [result({score: 6})],
      TODAY,
    );
    expect(queue).toHaveLength(1);
    expect(queue[0].score).toBe(6);
  });

  it('keeps different games on the same day apart', () => {
    const queue = upsertEntries(
      [result()],
      [result({game: 'tenball', score: 9, total: 10})],
      TODAY,
    );
    expect(queue).toHaveLength(2);
  });

  it('drops entries older than 14 days', () => {
    const queue = upsertEntries(
      [result({dateKey: '2026-06-01'})],
      [result()],
      TODAY,
    );
    expect(queue.map(e => e.dateKey)).toEqual([TODAY]);
  });
});

describe('queueDailyResult + flushOutbox', () => {
  it('holds results until a profile exists', async () => {
    await queueDailyResult(result());
    await flushOutbox();
    expect(mockPublishResults).not.toHaveBeenCalled();
    expect(await readQueue()).toHaveLength(1);
  });

  it('publishes and clears the queue once opted in', async () => {
    mockGetCachedProfile.mockResolvedValue(PROFILE);
    await queueDailyResult(result());
    await flushOutbox();
    expect(mockPublishResults).toHaveBeenCalledWith([result()]);
    expect(await readQueue()).toHaveLength(0);
  });

  it('keeps the queue when publishing fails (retry later)', async () => {
    mockGetCachedProfile.mockResolvedValue(PROFILE);
    mockPublishResults.mockRejectedValue(new Error('Network request failed'));
    await queueDailyResult(result());
    await flushOutbox();
    expect(await readQueue()).toHaveLength(1);
  });
});

describe('runBackfill', () => {
  it('queues recent history from every game and publishes it', async () => {
    mockGetCachedProfile.mockResolvedValue(PROFILE);
    await AsyncStorage.setItem(
      'mystery.history',
      JSON.stringify({
        '2026-07-10': {dateKey: '2026-07-10', status: 'won', guessCount: 4},
        // Too old — outside the 14-day window.
        '2026-06-01': {dateKey: '2026-06-01', status: 'won', guessCount: 2},
      }),
    );
    await AsyncStorage.setItem(
      'mystery.streak',
      JSON.stringify({current: 3, best: 5, lastCompletedDateKey: '2026-07-10'}),
    );
    await AsyncStorage.setItem(
      'tenball.history',
      JSON.stringify({
        '2026-07-09': {
          dateKey: '2026-07-09',
          listId: 'list-1',
          status: 'revealed',
          found: 7,
          misses: 12,
        },
      }),
    );

    await runBackfill(TODAY);

    expect(mockPublishResults).toHaveBeenCalledTimes(1);
    const sent: PublishedResult[] = mockPublishResults.mock.calls[0][0];
    expect(sent).toHaveLength(2);
    // Streak rides only on the streak's lastCompletedDateKey entry.
    expect(sent).toContainEqual({
      dateKey: '2026-07-10',
      game: 'scout',
      status: 'won',
      score: 4,
      total: null,
      streak: 3,
    });
    // Board games publish their miss count — the same number the Log shows.
    expect(sent).toContainEqual({
      dateKey: '2026-07-09',
      game: 'tenball',
      status: 'revealed',
      score: 12,
      total: null,
      streak: 0,
    });
  });

  it('runs only once', async () => {
    mockGetCachedProfile.mockResolvedValue(PROFILE);
    await AsyncStorage.setItem(
      'mystery.history',
      JSON.stringify({
        '2026-07-10': {dateKey: '2026-07-10', status: 'won', guessCount: 4},
      }),
    );
    await runBackfill(TODAY);
    await runBackfill(TODAY);
    expect(mockPublishResults).toHaveBeenCalledTimes(1);
  });
});
