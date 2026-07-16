import {matchmakingFacts, type Fact} from '../facts';
import {getClub} from '../clubs';
import {all, getById, matches, sharedClubsOf} from '../repository';
import type {Footballer} from '../types';
import {TREBLE_SQUADS} from '../trebles';
import {MANAGERS} from '../managers';
import en from '../../../core/i18n/en.json';
import da from '../../../core/i18n/da.json';

/** Deterministic rng, same LCG the cult-hero prompt tests use. */
function seededRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Resolve a dotted i18n key against a bundle. */
function lookup(bundle: unknown, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );
  return typeof value === 'string' ? value : undefined;
}

const placeholders = (template: string) =>
  [...template.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);

/** Render a fact the way i18next would, so we can read the finished sentence. */
function render(fact: Fact, bundle: unknown = en): string {
  const template = lookup(bundle, fact.key);
  if (template == null) {
    throw new Error(`missing key: ${fact.key}`);
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, p) => String(fact.params[p]));
}

/**
 * A big deterministic sample: enough draws to hit every template.
 *
 * 120, not 40: `leagueTitle` only fires for a player whose league-title honour
 * carries a `clubId`, and just ~20 of the ~1120 famous players have one (the
 * other 800-odd league titles are stored without a club). At ~1.8% per draw
 * that made 40 draws a coin flip — it scraped by with a single hit until the
 * pool grew. The sample size is not the assertion; every template firing is.
 */
const sample: Fact[] = Array.from({length: 120}, (_, i) =>
  matchmakingFacts(12, seededRng(i + 1)),
).flat();

/** Display name → row, the join key the truthfulness assertions read back. */
const byName = new Map<string, Footballer>(all().map(f => [f.name, f]));
const rowFor = (name: unknown): Footballer => {
  const row = byName.get(String(name));
  if (!row) {
    throw new Error(`no footballer named ${name}`);
  }
  return row;
};

describe('matchmakingFacts', () => {
  it('returns the asked number of facts, each about a different player', () => {
    const facts = matchmakingFacts(12, seededRng());
    expect(facts).toHaveLength(12);
    const subjects = facts.map(f => f.params.name ?? f.params.a);
    expect(new Set(subjects).size).toBe(12);
  });

  it('is deterministic under a seeded rng', () => {
    expect(matchmakingFacts(8, seededRng(7))).toEqual(
      matchmakingFacts(8, seededRng(7)),
    );
  });

  it('spreads a batch across templates rather than repeating one shape', () => {
    const kinds = new Set(matchmakingFacts(12, seededRng(3)).map(f => f.key));
    expect(kinds.size).toBeGreaterThanOrEqual(6);
  });
});

describe('fact copy', () => {
  // The guard against a raw "{{club}}" reaching the queue screen.
  it('resolves every fact in both languages with every placeholder filled', () => {
    for (const bundle of [en, da]) {
      for (const fact of sample) {
        const template = lookup(bundle, fact.key);
        expect(typeof template).toBe('string');
        for (const p of placeholders(template as string)) {
          expect(fact.params[p]).toBeDefined();
          expect(String(fact.params[p]).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never leaks a player id, an unresolved placeholder or a club slug', () => {
    for (const fact of sample) {
      const text = render(fact);
      expect(text).not.toMatch(/\{\{|\}\}/);
      expect(text).not.toMatch(/undefined|NaN|null/);
      // Ids read "Surname, First" and club ids are kebab slugs.
      expect(text).not.toMatch(/[a-z]+-[a-z]+-[a-z]+/);
    }
  });

  it('uses no plural-triggering `count` param (i18next would look for _plural)', () => {
    for (const fact of sample) {
      expect(fact.params.count).toBeUndefined();
    }
  });

  it('fires every template across the sample', () => {
    const shapes = new Set(sample.map(f => f.key.split('.').slice(0, 4).join('.')));
    for (const expected of [
      'rankedHattrick.fact.honourCount',
      'rankedHattrick.fact.honourYear',
      'rankedHattrick.fact.leagueTitle',
      'rankedHattrick.fact.oneClub',
      'rankedHattrick.fact.treble',
      'rankedHattrick.fact.teammates',
      'rankedHattrick.fact.careerCountries',
      'rankedHattrick.fact.managerSpell',
    ]) {
      expect([...shapes].some(s => s.startsWith(expected))).toBe(true);
    }
  });
});

// Every claim is re-derived from the dataset here. A template that reads a
// field the row doesn't have would ship a false sentence, which is the whole
// risk of generating copy from data.
describe('fact truthfulness', () => {
  const bySuffix = (suffix: string) =>
    sample.filter(f => f.key.startsWith(`rankedHattrick.fact.${suffix}`));

  it('honourCount totals match the row, and are never 1', () => {
    for (const fact of bySuffix('honourCount.')) {
      const type = fact.key.split('.').pop();
      const f = rowFor(fact.params.name);
      const total = f.honours
        .filter(h => h.type === type)
        .reduce((sum, h) => sum + (h.count ?? h.years?.length ?? 0), 0);
      expect(fact.params.times).toBe(total);
      expect(Number(fact.params.times)).toBeGreaterThanOrEqual(2);
    }
  });

  it('honourYear years come from the row', () => {
    for (const fact of bySuffix('honourYear.')) {
      const type = fact.key.split('.').pop();
      const f = rowFor(fact.params.name);
      const years = f.honours.filter(h => h.type === type).flatMap(h => h.years ?? []);
      expect(years).toContain(fact.params.year);
    }
  });

  it('oneClub players really have exactly one club and no loans', () => {
    for (const fact of bySuffix('oneClub')) {
      const f = rowFor(fact.params.name);
      expect(matches(f, {kind: 'oneClub'})).toBe(true);
      expect(f.clubs.some(s => s.loan)).toBe(false);
      expect(getClub(f.clubs[0].clubId)?.name).toBe(fact.params.club);
      expect(f.tags).toContain('legends');
    }
  });

  it('treble facts name a real squad member of that squad and season', () => {
    for (const fact of bySuffix('treble')) {
      const squad = TREBLE_SQUADS.find(
        s => getClub(s.clubId)?.name === fact.params.club && s.season === fact.params.season,
      );
      expect(squad).toBeDefined();
      const ids = squad!.playerIds.map(id => getById(id)?.name);
      expect(ids).toContain(fact.params.name);
    }
  });

  it('teammates actually overlapped at the named club', () => {
    for (const fact of bySuffix('teammates')) {
      const a = rowFor(fact.params.a);
      const b = rowFor(fact.params.b);
      expect(a.id).not.toBe(b.id);
      expect(matches(a, {kind: 'teammate', playerId: b.id})).toBe(true);
      expect(sharedClubsOf(a, b).map(id => getClub(id)?.name)).toContain(
        fact.params.club,
      );
    }
  });

  it('manager spells match the manager row', () => {
    for (const fact of [...bySuffix('managerSpell'), ...bySuffix('managerSpellCurrent')]) {
      const m = MANAGERS.find(x => x.name === fact.params.name);
      expect(m).toBeDefined();
      const spell = m!.spells.find(
        s => s.clubId && getClub(s.clubId)?.name === fact.params.club && s.from === fact.params.from,
      );
      expect(spell).toBeDefined();
      if (fact.key.endsWith('Current')) {
        expect(spell!.to).toBeUndefined();
      } else {
        expect(spell!.to).toBe(fact.params.to);
      }
    }
  });
});
