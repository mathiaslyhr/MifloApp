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
  const messi = getById('lionel-messi')!;

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
    ['honour miss', {kind: 'honour', honour: 'golden-boot'}, false],
    ['tag hit', {kind: 'tag', tag: 'legends'}, true],
    ['tag miss', {kind: 'tag', tag: 'unknown'}, false],
  ];

  it.each(cases)('%s', (_label, criterion, expected) => {
    expect(matches(messi, criterion)).toBe(expected);
  });
});

describe('leaguesOf', () => {
  it('derives leagues from club spells', () => {
    const messi = getById('lionel-messi')!;
    expect(leaguesOf(messi).sort()).toEqual(['la-liga', 'ligue-1', 'mls']);
  });
});

describe('find / intersection', () => {
  it('ANDs all criteria', () => {
    const result = find([
      {kind: 'league', league: 'premier-league'},
      {kind: 'nationality', country: 'Belgium'},
    ]);
    expect(result.map(f => f.id)).toEqual(['kevin-de-bruyne']);
  });

  it('intersection powers a tic-tac-toe cell (Barcelona ∩ Argentina → Messi)', () => {
    const result = intersection(
      {kind: 'club', clubId: 'barcelona'},
      {kind: 'nationality', country: 'Argentina'},
    );
    expect(result.map(f => f.id)).toEqual(['lionel-messi']);
  });

  it('empty criteria matches everyone', () => {
    expect(find([])).toHaveLength(all().length);
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
