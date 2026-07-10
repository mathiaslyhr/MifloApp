/**
 * OTA dataset sync: manifest poll with ETag, checksum + schema validation,
 * AsyncStorage caching, and the "never swap data mid-game" apply gate.
 * Everything fails OPEN — any error leaves the current (bundled) data alone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../../../core/i18n';
import {currentRouteName} from '../../../../core/navigation/navigationRef';
import {hashDateKey} from '../../../../games/scout/dailySeed';
import {dailyListIdFor} from '../../../../games/tenball/dailyList';
import {getListById} from '../../../../games/tenball/lists';
import {getById} from '../../index';
import {bundledSnapshot, hydrate, type ContentPack} from '../../store';
import {
  checkForUpdate,
  initFootballDataSync,
  maybeApplyPending,
  validateContentPack,
  __resetDatasetSyncForTests,
} from '../datasetSync';
import {APP_VERSION_CODE} from '../../../../core/config';

jest.mock('../../../../core/navigation/navigationRef', () => ({
  currentRouteName: jest.fn(),
}));

const mockRoute = currentRouteName as jest.Mock;
const mockFetch = jest.fn();
(globalThis as {fetch?: unknown}).fetch = mockFetch;

const CACHE_KEY = 'footballData.cache';

/** A fully valid content pack: the bundled data with one renamed player. */
function testPack(): ContentPack {
  const pack = bundledSnapshot();
  pack.footballers = pack.footballers!.map(f =>
    f.id === 'Rodrygo' ? {...f, name: 'Zzyzx Otatest'} : f,
  );
  pack.redCardQuestions = {
    ids: pack.redCardQuestions!.ids,
    i18n: {
      en: Object.fromEntries(pack.redCardQuestions!.ids.map(id => [id, 'Q?'])),
    },
  };
  pack.tenball = {
    ...pack.tenball!,
    i18n: {
      en: {
        lists: Object.fromEntries(
          pack.tenball!.lists.map(l => [l.id, {title: 'List?'}]),
        ),
      },
    },
  };
  return pack;
}

function serialize(pack: ContentPack, version = 'v-test-1') {
  const body = JSON.stringify({schemaVersion: 1, version, ...pack});
  return {
    body,
    manifest: {schemaVersion: 1, version, path: `datasets/dataset-${version}.json`, checksum: hashDateKey(body)},
  };
}

function respondWith(manifest: object, body: string, etag = '"etag-1"') {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('manifest.json')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: {get: (h: string) => (h.toLowerCase() === 'etag' ? etag : null)},
        json: () => Promise.resolve(manifest),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: {get: () => null},
      text: () => Promise.resolve(body),
    });
  });
}

beforeEach(async () => {
  mockFetch.mockReset();
  mockRoute.mockReturnValue('Tabs');
  await AsyncStorage.clear();
  __resetDatasetSyncForTests();
});

afterEach(() => {
  hydrate(bundledSnapshot());
});

describe('validateContentPack', () => {
  it('accepts a well-formed pack', () => {
    const {body} = serialize(testPack());
    expect(validateContentPack(JSON.parse(body))).toBeNull();
  });

  it('rejects wrong schema versions and truncated data', () => {
    const pack = JSON.parse(serialize(testPack()).body);
    expect(validateContentPack({...pack, schemaVersion: 2})).not.toBeNull();
    expect(validateContentPack({...pack, footballers: pack.footballers.slice(0, 10)})).not.toBeNull();
    expect(validateContentPack({...pack, clubs: undefined})).not.toBeNull();
  });

  it('rejects a pack whose art outruns this binary (unknown flag/crest)', () => {
    const pack = JSON.parse(serialize(testPack()).body);
    const atlantis = {...pack.footballers[0], id: 'Atlantis, Player', nationality: ['Atlantis']};
    expect(validateContentPack({...pack, footballers: [...pack.footballers, atlantis]})).not.toBeNull();

    const packWithClub = JSON.parse(serialize(testPack()).body);
    packWithClub.clubs = [...packWithClub.clubs, {id: 'no-crest-fc', name: 'X', country: 'England', league: 'premier-league'}];
    expect(validateContentPack(packWithClub)).not.toBeNull();
  });

  it('rejects unknown club refs, schedule ids, and uncovered question ids', () => {
    const base = () => JSON.parse(serialize(testPack()).body);

    const badSpell = base();
    badSpell.footballers[0] = {...badSpell.footballers[0], clubs: [{clubId: 'ghost-fc'}]};
    expect(validateContentPack(badSpell)).not.toBeNull();

    const badSchedule = base();
    badSchedule.scoutSchedule.dailySecrets['2099-01-01'] = 'Ghost, Player';
    expect(validateContentPack(badSchedule)).not.toBeNull();

    const badQuestions = base();
    badQuestions.redCardQuestions.ids = [...badQuestions.redCardQuestions.ids, 'q999'];
    expect(validateContentPack(badQuestions)).not.toBeNull();
  });

  it('accepts a pack published before Top Bins existed (no tenball section)', () => {
    const pack = JSON.parse(serialize(testPack()).body);
    delete pack.tenball;
    expect(validateContentPack(pack)).toBeNull();
  });

  it('rejects a malformed tenball section', () => {
    const base = () => JSON.parse(serialize(testPack()).body);

    const shortList = base();
    shortList.tenball.lists[0] = {
      ...shortList.tenball.lists[0],
      entries: shortList.tenball.lists[0].entries.slice(0, 9),
    };
    expect(validateContentPack(shortList)).not.toBeNull();

    const badSchedule = base();
    badSchedule.tenball.schedule['2099-01-01'] = 'ghost-list';
    expect(validateContentPack(badSchedule)).not.toBeNull();

    const noTitle = base();
    noTitle.tenball.i18n = {en: {lists: {}}};
    expect(validateContentPack(noTitle)).not.toBeNull();
  });
});

describe('checkForUpdate', () => {
  it('downloads, caches, and applies a new pack when no game is active', async () => {
    const {body, manifest} = serialize(testPack());
    respondWith(manifest, body);

    await checkForUpdate();

    expect(getById('Rodrygo')?.name).toBe('Zzyzx Otatest');
    const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? 'null');
    expect(cached?.manifest.version).toBe('v-test-1');
    expect(cached?.appVersionCode).toBe(APP_VERSION_CODE);
  });

  it('merges Red Card question strings into i18n on apply', async () => {
    const pack = testPack();
    pack.redCardQuestions!.i18n = {
      en: {
        ...(pack.redCardQuestions!.i18n!.en as Record<string, string>),
        q999: 'Brand new OTA question?',
      },
    };
    pack.redCardQuestions!.ids = [...pack.redCardQuestions!.ids, 'q999'];
    const {body, manifest} = serialize(pack);
    respondWith(manifest, body);

    await checkForUpdate();

    expect(i18n.t('redCard.questions.q999')).toBe('Brand new OTA question?');
  });

  it('applies tenball lists, schedule, and title strings from a pack', async () => {
    const pack = testPack();
    const otaList = {
      id: 'ota-test-list',
      entries: Array.from({length: 10}, (_, i) => ({
        rank: i + 1,
        name: `OTA Player ${i + 1}`,
        value: `${i + 1}`,
        aliases: [`ota player ${i + 1}`],
      })),
    };
    pack.tenball = {
      lists: [...pack.tenball!.lists, otaList],
      schedule: {...pack.tenball!.schedule, '2099-01-01': 'ota-test-list'},
      i18n: {
        en: {
          lists: {
            ...(pack.tenball!.i18n!.en as {lists: object}).lists,
            'ota-test-list': {title: 'Brand new OTA list'},
          },
        },
      },
    };
    const {body, manifest} = serialize(pack);
    respondWith(manifest, body);

    await checkForUpdate();

    expect(getListById('ota-test-list')?.entries).toHaveLength(10);
    expect(dailyListIdFor('2099-01-01')).toBe('ota-test-list');
    expect(i18n.t('tenball.lists.ota-test-list.title')).toBe('Brand new OTA list');
  });

  it('sends the stored ETag and stops at a 304', async () => {
    const {body, manifest} = serialize(testPack());
    respondWith(manifest, body, '"etag-42"');
    await checkForUpdate();

    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ok: false, status: 304, headers: {get: () => null}});
    await checkForUpdate();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1]?.headers?.['If-None-Match']).toBe('"etag-42"');
  });

  it('treats a 200 with the already-applied version as up to date', async () => {
    const {body, manifest} = serialize(testPack());
    respondWith(manifest, body);
    await checkForUpdate();

    mockFetch.mockClear();
    respondWith(manifest, body);
    await checkForUpdate();

    // Manifest re-fetched (NSURLSession can mask 304s) but no dataset download.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('stages but does not apply mid-game, then applies via maybeApplyPending', async () => {
    mockRoute.mockReturnValue('Hattrick');
    const {body, manifest} = serialize(testPack());
    respondWith(manifest, body);

    await checkForUpdate();
    expect(getById('Rodrygo')?.name).toBe('Rodrygo');

    mockRoute.mockReturnValue('Tabs');
    maybeApplyPending();
    expect(getById('Rodrygo')?.name).toBe('Zzyzx Otatest');
  });

  it('does not download a pack from a future manifest schema', async () => {
    const {body, manifest} = serialize(testPack());
    respondWith({...manifest, schemaVersion: 2}, body);

    await checkForUpdate();

    // Manifest fetched, but no dataset download and no apply.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(getById('Rodrygo')?.name).toBe('Rodrygo');
  });

  it('maybeApplyPending never throws out of a navigation transition', async () => {
    mockRoute.mockReturnValue('Hattrick');
    const {body, manifest} = serialize(testPack());
    respondWith(manifest, body);
    await checkForUpdate();

    const spy = jest
      .spyOn(i18n, 'addResourceBundle')
      .mockImplementation(() => {
        throw new Error('i18n exploded');
      });
    mockRoute.mockReturnValue('Tabs');
    expect(() => maybeApplyPending()).not.toThrow();
    spy.mockRestore();
  });

  it('ignores a pack with a bad checksum', async () => {
    const {body, manifest} = serialize(testPack());
    respondWith({...manifest, checksum: 12345}, body);

    await checkForUpdate();

    expect(getById('Rodrygo')?.name).toBe('Rodrygo');
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('ignores a pack that fails validation', async () => {
    const pack = testPack();
    pack.footballers = pack.footballers!.slice(0, 10);
    const {body, manifest} = serialize(pack);
    respondWith(manifest, body);

    await checkForUpdate();

    expect(getById('Rodrygo')?.name).toBe('Rodrygo');
  });

  it('swallows network errors silently', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate()).resolves.toBeUndefined();
    expect(getById('Rodrygo')?.name).toBe('Rodrygo');
  });
});

describe('initFootballDataSync', () => {
  it('applies a cached pack from this app version at cold start', async () => {
    const {body, manifest} = serialize(testPack());
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({etag: '"e"', manifest, datasetJson: body, appVersionCode: APP_VERSION_CODE}),
    );
    mockFetch.mockRejectedValue(new Error('offline'));

    await initFootballDataSync();

    expect(getById('Rodrygo')?.name).toBe('Zzyzx Otatest');
  });

  it('drops the cache after an app update', async () => {
    const {body, manifest} = serialize(testPack());
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({etag: '"e"', manifest, datasetJson: body, appVersionCode: '0.9.0'}),
    );
    mockFetch.mockRejectedValue(new Error('offline'));

    await initFootballDataSync();

    expect(getById('Rodrygo')?.name).toBe('Rodrygo');
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });
});
