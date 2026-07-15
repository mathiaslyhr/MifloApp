/**
 * @format
 */
import {TOPICS} from '../../../games/quiz/mockData';
import {getClub} from '../clubs';
import {
  all,
  byCategory,
  find,
  getById,
  intersection,
  leaguesOf,
  matches,
} from '../repository';
import type {Criterion} from '../types';

describe('data integrity', () => {
  it('every footballer references real clubs and has a unique id', () => {
    const ids = new Set<string>();
    for (const f of all()) {
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
      for (const spell of f.clubs) {
        expect(getClub(spell.clubId)).toBeDefined();
      }
    }
  });
});

describe('matches', () => {
  const messi = getById('Messi, Lionel')!;

  const cases: [string, Criterion, boolean][] = [
    ['club hit', {kind: 'club', clubId: 'barcelona'}, true],
    ['club miss', {kind: 'club', clubId: 'real-madrid'}, false],
    ['league hit', {kind: 'league', league: 'ligue-1'}, true],
    ['league miss', {kind: 'league', league: 'serie-a'}, false],
    ['nationality hit', {kind: 'nationality', country: 'Argentina'}, true],
    ['nationality miss', {kind: 'nationality', country: 'Brazil'}, false],
    ['position hit', {kind: 'position', position: 'FW'}, true],
    ['position miss', {kind: 'position', position: 'GK'}, false],
    ['honour hit', {kind: 'honour', honour: 'world-cup'}, true],
    ['honour miss', {kind: 'honour', honour: 'european-championship'}, false],
    ['tag hit', {kind: 'tag', tag: 'legends'}, true],
    ['tag miss', {kind: 'tag', tag: 'unknown'}, false],
    ['bornDecade hit', {kind: 'bornDecade', decade: 1980}, true],
    ['bornDecade miss', {kind: 'bornDecade', decade: 1990}, false],
    ['oneClub miss', {kind: 'oneClub'}, false],
    ['honourYear hit', {kind: 'honourYear', honour: 'copa-america', year: 2021}, true],
    ['honourYear miss', {kind: 'honourYear', honour: 'world-cup', year: 2018}, false],
    ['playedInCountry hit', {kind: 'playedInCountry', country: 'Spain'}, true],
    ['playedInCountry miss', {kind: 'playedInCountry', country: 'Italy'}, false],
    ['continent hit', {kind: 'continent', continent: 'South America'}, true],
    ['continent miss', {kind: 'continent', continent: 'Europe'}, false],
    ['managedBy hit', {kind: 'managedBy', managerId: 'Guardiola, Pep'}, true],
    ['managedBy miss', {kind: 'managedBy', managerId: 'Mourinho, José'}, false],
  ];

  it.each(cases)('%s', (_label, criterion, expected) => {
    expect(matches(messi, criterion)).toBe(expected);
  });
});

describe('leaguesOf', () => {
  it('derives leagues from club spells', () => {
    const messi = getById('Messi, Lionel')!;
    expect(leaguesOf(messi).sort()).toEqual(['la-liga', 'ligue-1', 'mls']);
  });
});

describe('find / intersection', () => {
  it('ANDs all criteria (every result satisfies all, known member included)', () => {
    const result = find([
      {kind: 'league', league: 'premier-league'},
      {kind: 'nationality', country: 'Belgium'},
    ]);
    expect(result.map(f => f.id)).toContain('De Bruyne, Kevin');
    expect(
      result.every(
        f =>
          f.nationality.includes('Belgium') &&
          leaguesOf(f).includes('premier-league'),
      ),
    ).toBe(true);
  });

  it('intersection powers a hattrick cell (Barcelona ∩ Argentina includes Messi)', () => {
    const result = intersection(
      {kind: 'club', clubId: 'barcelona'},
      {kind: 'nationality', country: 'Argentina'},
    );
    expect(result.map(f => f.id)).toContain('Messi, Lionel');
    expect(
      result.every(
        f =>
          f.nationality.includes('Argentina') &&
          f.clubs.some(s => s.clubId === 'barcelona'),
      ),
    ).toBe(true);
  });

  it('empty criteria matches everyone', () => {
    expect(find([])).toHaveLength(all().length);
  });
});

describe('leagueTitle', () => {
  // A title won in a transfer year (the old club's `to`, the new club's `from`)
  // must be credited to the club left, not the club joined. Ribéry won his
  // final Bundesliga title with Bayern in 2019 and moved to Fiorentina that
  // same summer — he never won Serie A.
  it('credits a transfer-year title to the club left, not the club joined', () => {
    const ribery = getById('Ribéry, Franck')!;
    expect(matches(ribery, {kind: 'leagueTitle', league: 'bundesliga'})).toBe(
      true,
    );
    expect(matches(ribery, {kind: 'leagueTitle', league: 'serie-a'})).toBe(
      false,
    );
  });
});

describe('byCategory', () => {
  it('every quiz topic returns at least one footballer', () => {
    for (const topic of TOPICS) {
      expect(byCategory(topic.id).length).toBeGreaterThan(0);
    }
  });

  it('unknown topic returns empty', () => {
    expect(byCategory('nope')).toEqual([]);
  });
});
