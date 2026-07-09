/**
 * Structural integrity of the expanded football dataset. These guard the SHAPE
 * of the data (broken references, malformed honours, too-thin pools) — they do
 * NOT and cannot verify factual accuracy (that a player really won X). Factual
 * curation is a manual discipline; see footballers.ts.
 */
import {
  buildQuestions,
  countMatchingQuestions,
  usedFootballers,
} from '../../../games/quiz/questions';
import {CLUBS, getClub} from '../clubs';
import {all, byCategory} from '../repository';
import type {Rng} from '../repository';
import {FLAG_IMAGES} from '../../../games/hattrick/assets/flags.generated';
import {LOGO_IMAGES} from '../../../games/hattrick/assets/logos.generated';

/** Leagues the data is allowed to use — a typo like "seria-a" must fail here. */
const KNOWN_LEAGUES = new Set([
  'premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1', 'mls',
  'saudi-pro-league', 'primeira-liga', 'eredivisie', 'brasileirao',
  'liga-argentina', 'liga-mx', 'super-lig', 'scottish-premiership',
  'championship', 'belgian-pro-league', 'qatar-stars-league',
  'egyptian-premier-league', 'south-african-league', 'swiss-super-league',
  'austrian-bundesliga', 'croatian-hnl', 'danish-superliga', 'ukrainian-league',
  'hungarian-league', 'greek-super-league',
]);

/** Deterministic RNG (mulberry32) so freshness/sampling is reproducible. */
function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('referential integrity', () => {
  it('every footballer id is unique', () => {
    const ids = all().map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every footballer display name is unique', () => {
    // Quiz answers and search resolve players by display name — a duplicate
    // (e.g. two Ronaldo Nazário entries) makes questions ambiguous.
    const names = all().map(f => f.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it('every referenced clubId exists in CLUBS', () => {
    for (const f of all()) {
      for (const spell of f.clubs) {
        expect(getClub(spell.clubId)).toBeDefined();
      }
    }
  });

  it('no club spell ends before it starts', () => {
    for (const f of all()) {
      for (const spell of f.clubs) {
        if (spell.from !== undefined && spell.to !== undefined) {
          expect(spell.to).toBeGreaterThanOrEqual(spell.from);
        }
      }
    }
  });

  it('every season stat references a real club and a club the player had', () => {
    for (const f of all()) {
      const ownClubs = new Set(f.clubs.map(s => s.clubId));
      for (const stat of f.seasonStats ?? []) {
        expect(getClub(stat.clubId)).toBeDefined();
        expect(ownClubs.has(stat.clubId)).toBe(true);
      }
    }
  });

  it('season stat tallies are sane (0–60 goals/assists, 0–60 apps)', () => {
    for (const f of all()) {
      for (const stat of f.seasonStats ?? []) {
        for (const n of [stat.goals, stat.assists, stat.appearances]) {
          if (n !== undefined) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(60);
          }
        }
      }
    }
  });
});

describe('club + shape integrity', () => {
  it('every club id is unique', () => {
    const ids = CLUBS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every club league is a known league', () => {
    for (const c of CLUBS) {
      expect(KNOWN_LEAGUES.has(c.league)).toBe(true);
    }
  });

  it('every footballer has a nationality, position and club', () => {
    for (const f of all()) {
      expect(f.nationality.length).toBeGreaterThanOrEqual(1);
      expect(f.positions.length).toBeGreaterThanOrEqual(1);
      expect(f.clubs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every footballer has a valid date of birth (drives the Scout Age column)', () => {
    const invalid: string[] = [];
    for (const f of all()) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.born);
      if (!m) {
        invalid.push(`${f.id}: ${f.born}`);
        continue;
      }
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const date = new Date(Date.UTC(y, mo - 1, d));
      // A rolled-over Date (e.g. Feb 30 → Mar 2) means the day/month is invalid.
      const real =
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === mo - 1 &&
        date.getUTCDate() === d;
      if (!real || y < 1930 || y > 2012) {
        invalid.push(`${f.id}: ${f.born}`);
      }
    }
    expect(invalid).toEqual([]);
  });
});

describe('every criterion has a real image asset', () => {
  // Guarantees a new nation/club added in a dataset batch can't ship without
  // its flag/crest — regenerate with `npm run assets:flags && assets:logos`.
  it('every nationality + club country has a bundled flag', () => {
    const countries = new Set<string>();
    for (const f of all()) for (const n of f.nationality) countries.add(n);
    for (const c of CLUBS) countries.add(c.country);
    for (const country of countries) {
      expect(FLAG_IMAGES[country]).toBeDefined();
    }
  });

  it('every club a footballer played for has a bundled crest', () => {
    const usedClubIds = new Set<string>();
    for (const f of all()) for (const s of f.clubs) usedClubIds.add(s.clubId);
    for (const clubId of usedClubIds) {
      expect(LOGO_IMAGES[clubId]).toBeDefined();
    }
  });
});

describe('honour integrity', () => {
  it('every Ballon d\'Or honour lists years matching its count', () => {
    for (const f of all()) {
      for (const h of f.honours) {
        if (h.type === 'ballon-dor') {
          expect(h.years).toBeDefined();
          expect(h.years!.length).toBe(h.count);
        }
      }
    }
  });

  it('any honour years never exceed its count', () => {
    for (const f of all()) {
      for (const h of f.honours) {
        if (h.years && h.count !== undefined) {
          expect(h.years.length).toBeLessThanOrEqual(h.count);
        }
      }
    }
  });

  it('has at least 4 distinct Ballon d\'Or winners with years (ballonDorYear needs them)', () => {
    const winners = all().filter(f =>
      f.honours.some(h => h.type === 'ballon-dor' && (h.years?.length ?? 0) > 0),
    );
    expect(winners.length).toBeGreaterThanOrEqual(4);
  });
});

describe('category pools are deep enough', () => {
  // [topic, min footballers, min generatable questions]
  const cases: [string, number, number][] = [
    ['premier-league', 15, 40],
    ['la-liga', 15, 40],
    ['serie-a', 12, 35],
    ['bundesliga', 8, 20],
    ['ligue-1', 8, 20],
    ['champions-league', 20, 40],
    ['world-cup', 15, 40],
    ['ballon-dor', 12, 40],
    ['current-stars', 12, 40],
    ['legends', 25, 60],
  ];

  it.each(cases)('%s has a deep pool', (topic, minPlayers, minQuestions) => {
    expect(byCategory(topic).length).toBeGreaterThanOrEqual(minPlayers);
    expect(countMatchingQuestions([topic])).toBeGreaterThanOrEqual(minQuestions);
  });

  it('the "all" pool dwarfs a single game', () => {
    expect(countMatchingQuestions(['all'])).toBeGreaterThanOrEqual(120);
  });

  it('the new data dimensions are actually populated', () => {
    const currentStars = all().filter(f => (f.tags ?? []).includes('current-stars'));
    expect(currentStars.length).toBeGreaterThanOrEqual(12);
    const withSeasonStats = all().filter(f => (f.seasonStats ?? []).length > 0);
    expect(withSeasonStats.length).toBeGreaterThanOrEqual(5);
  });
});

describe('three back-to-back rounds stay full and fresh', () => {
  it('builds 20 → exclude → 20 → exclude → 20, all full', () => {
    const rng = seededRng(42);
    const exclude = new Set<string>();
    for (let round = 0; round < 3; round++) {
      const qs = buildQuestions(['all'], 20, {rng, exclude});
      expect(qs).toHaveLength(20);
      for (const id of usedFootballers(qs)) {
        exclude.add(id);
      }
    }
  });
});
