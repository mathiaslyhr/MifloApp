import AsyncStorage from '@react-native-async-storage/async-storage';
import {reconcileStaleDailyProgress} from '../reconcile';
import {loadHistory as loadTenballHistory, loadRawProgress as loadTenballProgress} from '../../../games/tenball/storage';
import {loadHistory as loadScoutHistory} from '../../../games/scout/mysteryStorage';
import type {PublishedResult} from '../../social/types';

// Keep the real supabase client out of the worker; reconcile reaches it only
// through queueDailyResult -> flushOutbox, which no-ops without a profile.
jest.mock('../../social/socialService', () => ({
  getCachedProfile: jest.fn().mockResolvedValue(null),
  publishResults: jest.fn().mockResolvedValue(undefined),
}));

const TODAY = '2026-07-12';
const YESTERDAY = '2026-07-11';

async function readQueue(): Promise<PublishedResult[]> {
  const raw = await AsyncStorage.getItem('social.outbox');
  return raw ? JSON.parse(raw) : [];
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('reconcileStaleDailyProgress', () => {
  it('fails a stale unfinished Top Bins day: records revealed + queues right/wrong', async () => {
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({
        dateKey: YESTERDAY,
        listId: 'list-1',
        guesses: [
          {text: 'a', rank: 1},
          {text: 'b', rank: 2},
          {text: 'c', rank: 3},
          {text: 'x'},
        ],
        gaveUp: false,
      }),
    );

    await reconcileStaleDailyProgress(TODAY);

    // Local history now has a failed entry with found/misses from the guesses.
    const history = await loadTenballHistory();
    expect(history[YESTERDAY]).toEqual({
      dateKey: YESTERDAY,
      listId: 'list-1',
      status: 'revealed',
      found: 3,
      misses: 1,
    });
    // The wire row: wrong in score, right in total, broken streak.
    expect(await readQueue()).toContainEqual({
      dateKey: YESTERDAY,
      game: 'tenball',
      status: 'revealed',
      score: 1,
      total: 3,
      streak: 0,
    });
    // The stale slot is cleared so a relaunch is a no-op.
    expect(await loadTenballProgress()).toBeNull();
  });

  it('fails a stale Scout day as lost (0 right, all guesses wrong)', async () => {
    await AsyncStorage.setItem(
      'mystery.progress',
      JSON.stringify({dateKey: YESTERDAY, guessedIds: ['p1', 'p2', 'p3'], secretId: 's'}),
    );

    await reconcileStaleDailyProgress(TODAY);

    expect((await loadScoutHistory())[YESTERDAY]).toEqual({
      dateKey: YESTERDAY,
      status: 'lost',
      guessCount: 3,
    });
    expect(await readQueue()).toContainEqual({
      dateKey: YESTERDAY,
      game: 'scout',
      status: 'revealed',
      score: 3,
      total: 0,
      streak: 0,
    });
  });

  it("leaves today's in-progress day untouched", async () => {
    const progress = {
      dateKey: TODAY,
      listId: 'list-1',
      guesses: [{text: 'a', rank: 1}],
      gaveUp: false,
    };
    await AsyncStorage.setItem('tenball.progress', JSON.stringify(progress));

    await reconcileStaleDailyProgress(TODAY);

    expect(await loadTenballHistory()).toEqual({});
    expect(await readQueue()).toHaveLength(0);
    expect(await loadTenballProgress()).toEqual(progress);
  });

  it('is a no-op when the stale day is already in history', async () => {
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({
        dateKey: YESTERDAY,
        listId: 'list-1',
        guesses: [{text: 'a', rank: 1}],
        gaveUp: true,
      }),
    );
    await AsyncStorage.setItem(
      'tenball.history',
      JSON.stringify({
        [YESTERDAY]: {
          dateKey: YESTERDAY,
          listId: 'list-1',
          status: 'won',
          found: 10,
          misses: 2,
        },
      }),
    );

    await reconcileStaleDailyProgress(TODAY);

    // The finished entry is preserved, nothing is queued, slot is cleared.
    expect((await loadTenballHistory())[YESTERDAY].status).toBe('won');
    expect(await readQueue()).toHaveLength(0);
    expect(await loadTenballProgress()).toBeNull();
  });

  it('ignores a stale day with no real play', async () => {
    await AsyncStorage.setItem(
      'tenball.progress',
      JSON.stringify({dateKey: YESTERDAY, listId: 'list-1', guesses: [], gaveUp: false}),
    );

    await reconcileStaleDailyProgress(TODAY);

    expect(await loadTenballHistory()).toEqual({});
    expect(await readQueue()).toHaveLength(0);
  });
});
