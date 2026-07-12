/**
 * Builds Offside rounds from the shared football fact layer
 * (src/data/football). A round picks an attribute (a `Criterion`), draws three
 * players who satisfy it and one outlier who provably doesn't, then shuffles
 * the four. The criterion is kept on the round so the answer is re-verifiable
 * (server-side too) — there is exactly one outlier by construction.
 *
 * The host generates the deck ONCE at start and ships it in the start RPC, so
 * everyone in the room gets identical rounds. `rng` is injectable so tests are
 * deterministic.
 */
import {
  all,
  clubCountriesOf,
  CONTINENTS,
  continentOf,
  find,
  leaguesOf,
  LEAGUE_LABELS,
  MANAGERS,
  matches,
  sample,
  shuffle,
  type Criterion,
  type Footballer,
  type HonourType,
  type Rng,
} from '../../data/football';
import type {OffsideCard, OffsideRound} from './types';

/**
 * A round to try to build: the shared link the three matchers satisfy, plus an
 * OPTIONAL constraint the outlier must ALSO satisfy. The outlier constraint
 * keeps "generational" rounds fair (e.g. legends vs. a current star), where a
 * random non-matcher would be too obscure to spot.
 */
type RoundSpec = {criterion: Criterion; outlier?: Criterion};

/** Honours common enough to build fair "won it" rounds from. */
const HONOURS: HonourType[] = [
  'champions-league',
  'world-cup',
  'ballon-dor',
  'european-championship',
  'europa-league',
  'copa-america',
  'golden-boot',
  'player-of-the-season',
];

/** Tournaments where "won it in YEAR" is a shared, guessable achievement. */
const YEAR_TOURNAMENTS: HonourType[] = [
  'world-cup',
  'champions-league',
  'european-championship',
  'copa-america',
  'europa-league',
];

/** Iconic shirt numbers — restricted so rounds stay recognizable. */
const ICONIC_NUMBERS = [7, 9, 10];

/** Hub players with enough teammates to anchor a "played alongside X" round. */
const TEAMMATE_HUBS = [
  'Messi, Lionel',
  'Ronaldo, Cristiano',
  'Xavi',
  'Iniesta, Andrés',
  'Ramos, Sergio',
  'Ibrahimović, Zlatan',
  'Gerrard, Steven',
  'Rooney, Wayne',
  'Buffon, Gianluigi',
];

/** Big footballing nations to surface for the "played in COUNTRY" axis. */
const PLAYED_IN_COUNTRIES = [
  'England',
  'Spain',
  'Italy',
  'Germany',
  'France',
  'Portugal',
  'Netherlands',
  'Turkey',
  'Saudi Arabia',
  'USA',
  'Brazil',
  'Argentina',
  'Mexico',
];

function cardOf(f: Footballer): OffsideCard {
  return {footballerId: f.id, name: f.name};
}

/** Count distinct players per value of some key, then keep values with ≥`min`. */
function frequentValues<T>(valuesOf: (f: Footballer) => T[], min = 3): T[] {
  const counts = new Map<T, number>();
  for (const f of all()) {
    for (const v of new Set(valuesOf(f))) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, c]) => c >= min).map(([v]) => v);
}

/** (honour, year) pairs at least three players share — for trophy-by-year. */
function frequentHonourYears(): Array<{honour: HonourType; year: number}> {
  const counts = new Map<string, number>();
  for (const f of all()) {
    const seen = new Set<string>();
    for (const h of f.honours) {
      if (!YEAR_TOURNAMENTS.includes(h.type)) {
        continue;
      }
      for (const year of h.years ?? []) {
        seen.add(`${h.type}|${year}`);
      }
    }
    for (const key of seen) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .map(([key]) => {
      const [honour, year] = key.split('|');
      return {honour: honour as HonourType, year: Number(year)};
    });
}

/** Every attribute worth building a round from, given the current data. */
function attributeCriteria(): RoundSpec[] {
  const spec = (criterion: Criterion, outlier?: Criterion): RoundSpec => ({
    criterion,
    outlier,
  });
  const specs: RoundSpec[] = [];

  // Group A — trophies, nationality, clubs, positions, leagues, numbers, mates.
  for (const honour of HONOURS) {
    specs.push(spec({kind: 'honour', honour}));
  }
  for (const country of frequentValues(f => f.nationality)) {
    specs.push(spec({kind: 'nationality', country}));
  }
  for (const clubId of frequentValues(f => f.clubs.map(s => s.clubId))) {
    specs.push(spec({kind: 'club', clubId}));
  }
  for (const position of frequentValues(f => f.positions)) {
    specs.push(spec({kind: 'position', position}));
  }
  for (const league of frequentValues(leaguesOf).filter(l => l in LEAGUE_LABELS)) {
    specs.push(spec({kind: 'league', league}));
  }
  for (const number of ICONIC_NUMBERS) {
    specs.push(spec({kind: 'shirtNumber', number}));
  }
  for (const playerId of TEAMMATE_HUBS) {
    specs.push(spec({kind: 'teammate', playerId}));
  }

  // Group B — era, loyalty, trophy-by-year, geography.
  for (const decade of frequentValues(f => decadesOf(f))) {
    specs.push(spec({kind: 'bornDecade', decade}));
  }
  specs.push(spec({kind: 'oneClub'}));
  for (const {honour, year} of frequentHonourYears()) {
    specs.push(spec({kind: 'honourYear', honour, year}));
  }
  for (const country of frequentValues(clubCountriesOf).filter(c =>
    PLAYED_IN_COUNTRIES.includes(c),
  )) {
    specs.push(spec({kind: 'playedInCountry', country}));
  }
  for (const continent of frequentValues(continentsOf).filter(c =>
    CONTINENTS.includes(c),
  )) {
    specs.push(spec({kind: 'continent', continent}));
  }

  // Group C — managed by.
  for (const manager of MANAGERS) {
    specs.push(spec({kind: 'managedBy', managerId: manager.id}));
  }

  // Group D — legends cut: three all-time greats, odd one out is a current star.
  specs.push(
    spec({kind: 'tag', tag: 'legends'}, {kind: 'tag', tag: 'current-stars'}),
  );

  return specs;
}

/** The decade a footballer was born in (e.g. 1993 → [1990]); [] if unknown. */
function decadesOf(f: Footballer): number[] {
  const year = Number.parseInt(f.born.slice(0, 4), 10);
  return Number.isNaN(year) ? [] : [Math.floor(year / 10) * 10];
}

/** The continents a footballer's nationalities map to (deduped downstream). */
function continentsOf(f: Footballer) {
  return f.nationality
    .map(continentOf)
    .filter((c): c is NonNullable<typeof c> => c != null);
}

/** Build one round from a spec, skipping used players; null if it can't. */
function buildOne(
  {criterion, outlier: outlierCriterion}: RoundSpec,
  rng: Rng,
  used: Set<string>,
): OffsideRound | null {
  const matching = find([criterion]).filter(f => !used.has(f.id));
  const outliers = all().filter(
    f =>
      !used.has(f.id) &&
      !matches(f, criterion) &&
      (!outlierCriterion || matches(f, outlierCriterion)),
  );
  if (matching.length < 3 || outliers.length < 1) {
    return null;
  }

  const three = sample(matching, 3, rng);
  const [outlier] = sample(outliers, 1, rng);
  for (const f of [...three, outlier]) {
    used.add(f.id);
  }

  const cards = shuffle([...three.map(cardOf), cardOf(outlier)], rng);
  const outlierIndex = cards.findIndex(c => c.footballerId === outlier.id);

  return {cards, outlierIndex, criterion};
}

export type BuildOptions = {rng?: Rng};

/**
 * Generate up to `count` rounds. Each player appears in at most one round, so
 * output is capped by the pool — returns fewer rounds rather than reusing
 * players. The Lobby ships `deck.length` as the round count, so a capped deck
 * just makes a shorter game.
 */
export function buildRounds(
  count: number,
  options: BuildOptions = {},
): OffsideRound[] {
  const {rng = Math.random} = options;
  const specs = shuffle(attributeCriteria(), rng);
  if (specs.length === 0) {
    return [];
  }
  const used = new Set<string>();
  const rounds: OffsideRound[] = [];
  // Walk specs round-robin; stop when full or when a full pass yields nothing.
  let sinceProgress = 0;
  let i = 0;
  while (rounds.length < count && sinceProgress < specs.length) {
    const round = buildOne(specs[i % specs.length], rng, used);
    if (round) {
      rounds.push(round);
      sinceProgress = 0;
    } else {
      sinceProgress++;
    }
    i++;
  }
  return rounds;
}
