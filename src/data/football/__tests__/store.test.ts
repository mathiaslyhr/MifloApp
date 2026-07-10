/**
 * The OTA content store: hydrate() swaps the bundled data for a downloaded
 * content pack by mutating the exported arrays/objects IN PLACE, so every
 * import site keeps working on the same references. Derived structures
 * (id maps, name pools) rebuild lazily via the generation counter.
 *
 * Hydration always receives freshly-parsed objects (remote JSON), so these
 * tests build modified entries as copies — never by mutating bundled objects.
 */
import {
  all,
  getById,
  getClub,
  FOOTBALLERS,
  MANAGERS,
  TREBLE_WINNER_IDS,
} from '../index';
import {bundledSnapshot, derivedFromData, generation, hydrate} from '../store';
import {dailySecretFor as journeymanSecretFor} from '../../../games/journeyman/dailySeed';
import {dailySecretFor} from '../../../games/scout/dailySeed';
import {dailyLineupIdFor} from '../../../games/teamsheet/dailySeed';
import {suggestNames} from '../../../games/missing-xi/matching';
import {buildQuestionIds} from '../../../games/red-card/questions';

afterEach(() => {
  hydrate(bundledSnapshot());
});

test('hydrate swaps footballers in place: lookups update, references do not', () => {
  const before = FOOTBALLERS;
  const snapshot = bundledSnapshot();
  const footballers = snapshot.footballers!.map(f =>
    f.id === 'Rodrygo' ? {...f, name: 'Zzyzx Otatest'} : f,
  );

  hydrate({footballers});

  expect(FOOTBALLERS).toBe(before);
  expect(getById('Rodrygo')?.name).toBe('Zzyzx Otatest');
  expect(all().length).toBe(footballers.length);
});

test('hydrate restores bundled data from the snapshot', () => {
  const original = getById('Rodrygo')?.name;
  const snapshot = bundledSnapshot();
  hydrate({
    footballers: snapshot.footballers!.map(f =>
      f.id === 'Rodrygo' ? {...f, name: 'Zzyzx Otatest'} : f,
    ),
  });
  hydrate(bundledSnapshot());
  expect(getById('Rodrygo')?.name).toBe(original);
});

test('hydrate updates clubs: getClub reflects the new pack', () => {
  const snapshot = bundledSnapshot();
  const clubs = snapshot.clubs!.map(c =>
    c.id === 'real-madrid' ? {...c, name: 'Real Madrid OTA'} : c,
  );

  hydrate({clubs});

  expect(getClub('real-madrid')?.name).toBe('Real Madrid OTA');
});

test('hydrate updates managers in place', () => {
  const before = MANAGERS;
  const snapshot = bundledSnapshot();
  const managers = snapshot.managers!.map(m =>
    m.id === 'Ancelotti, Carlo' ? {...m, name: 'Carlo OTA'} : m,
  );

  hydrate({managers});

  expect(MANAGERS).toBe(before);
  expect(MANAGERS.find(m => m.id === 'Ancelotti, Carlo')?.name).toBe('Carlo OTA');
});

test('hydrate rebuilds treble winners from the new squads', () => {
  const snapshot = bundledSnapshot();
  const trebleSquads = snapshot.trebleSquads!.map((s, i) =>
    i === 0 ? {...s, playerIds: [...s.playerIds, 'Otatest, Zzyzx']} : s,
  );

  expect(TREBLE_WINNER_IDS.has('Otatest, Zzyzx')).toBe(false);
  hydrate({trebleSquads});
  expect(TREBLE_WINNER_IDS.has('Otatest, Zzyzx')).toBe(true);
});

test('hydrate replaces the Scout schedule: dailySecretFor honours new entries', () => {
  const snapshot = bundledSnapshot();
  hydrate({
    scoutSchedule: {
      dailySecrets: {...snapshot.scoutSchedule!.dailySecrets, '2099-12-31': 'Rodrygo'},
    },
  });

  expect(dailySecretFor('2099-12-31').id).toBe('Rodrygo');
});

test('hydrate replaces the Journeyman schedule and restores it from the snapshot', () => {
  const snapshot = bundledSnapshot();
  hydrate({
    journeymanSchedule: {
      dailySecrets: {
        ...snapshot.journeymanSchedule!.dailySecrets,
        '2099-12-31': 'Rodrygo',
      },
    },
  });
  expect(journeymanSecretFor('2099-12-31').id).toBe('Rodrygo');

  // A pack without the section keeps the current schedule (fail open)…
  hydrate({});
  expect(journeymanSecretFor('2099-12-31').id).toBe('Rodrygo');

  // …and the bundled snapshot round-trips it back out.
  hydrate(bundledSnapshot());
  expect(
    bundledSnapshot().journeymanSchedule!.dailySecrets['2099-12-31'],
  ).toBeUndefined();
});

test('hydrate replaces the Team sheet schedule and restores it from the snapshot', () => {
  const snapshot = bundledSnapshot();
  const anyLineupId = snapshot.famousLineups![0].id;
  hydrate({
    teamsheetSchedule: {
      schedule: {...snapshot.teamsheetSchedule!.schedule, '2099-12-31': anyLineupId},
    },
  });
  expect(dailyLineupIdFor('2099-12-31')).toBe(anyLineupId);

  // A pack without the section keeps the current schedule (fail open)…
  hydrate({});
  expect(dailyLineupIdFor('2099-12-31')).toBe(anyLineupId);

  // …and the bundled snapshot round-trips it back out.
  hydrate(bundledSnapshot());
  expect(
    bundledSnapshot().teamsheetSchedule!.schedule['2099-12-31'],
  ).toBeUndefined();
});

test('missing-xi suggestions pick up a renamed player after hydrate', () => {
  const snapshot = bundledSnapshot();
  hydrate({
    footballers: snapshot.footballers!.map(f =>
      f.id === 'Rodrygo' ? {...f, name: 'Zzyzx Otatest'} : f,
    ),
  });

  expect(suggestNames('zzyzx')).toContain('Zzyzx Otatest');
});

test('red card deals only from a hydrated question pool', () => {
  hydrate({redCardQuestions: {ids: ['q1', 'q2', 'q3']}});

  const hand = buildQuestionIds(3, () => 0.5, []);
  expect([...hand].sort()).toEqual(['q1', 'q2', 'q3']);
});

test('derivedFromData recomputes exactly once per hydrate', () => {
  let calls = 0;
  const poolSize = derivedFromData(() => {
    calls++;
    return all().length;
  });

  expect(poolSize()).toBe(all().length);
  poolSize();
  expect(calls).toBe(1);

  hydrate({});
  poolSize();
  poolSize();
  expect(calls).toBe(2);
});

test('every hydrate bumps the generation counter', () => {
  const before = generation();
  hydrate({});
  expect(generation()).toBe(before + 1);
});
