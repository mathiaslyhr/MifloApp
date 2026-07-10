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
  find,
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
 * Only the honours common enough to build fair rounds from — and the only
 * criteria `explanationFor` has i18n templates for. Extending this list means
 * adding matching `offside.explanation.*` keys.
 */
const HONOURS: HonourType[] = [
  'champions-league',
  'world-cup',
  'ballon-dor',
  'european-championship',
];

function cardOf(f: Footballer): OffsideCard {
  return {footballerId: f.id, name: f.name};
}

/** Count distinct players per value of some key, then keep values with ≥3. */
function frequentValues<T>(valuesOf: (f: Footballer) => T[], min = 3): T[] {
  const counts = new Map<T, number>();
  for (const f of all()) {
    for (const v of new Set(valuesOf(f))) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, c]) => c >= min).map(([v]) => v);
}

/** Every attribute worth building a round from, given the current data. */
function attributeCriteria(): Criterion[] {
  const criteria: Criterion[] = [];
  for (const honour of HONOURS) {
    criteria.push({kind: 'honour', honour});
  }
  for (const country of frequentValues(f => f.nationality)) {
    criteria.push({kind: 'nationality', country});
  }
  for (const clubId of frequentValues(f => f.clubs.map(s => s.clubId))) {
    criteria.push({kind: 'club', clubId});
  }
  for (const position of frequentValues(f => f.positions)) {
    criteria.push({kind: 'position', position});
  }
  return criteria;
}

/** Build one round from a criterion, skipping used players; null if it can't. */
function buildOne(
  criterion: Criterion,
  rng: Rng,
  used: Set<string>,
): OffsideRound | null {
  const matching = find([criterion]).filter(f => !used.has(f.id));
  const outliers = all().filter(f => !used.has(f.id) && !matches(f, criterion));
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
  const criteria = shuffle(attributeCriteria(), rng);
  if (criteria.length === 0) {
    return [];
  }
  const used = new Set<string>();
  const rounds: OffsideRound[] = [];
  // Walk criteria round-robin; stop when full or when a full pass yields nothing.
  let sinceProgress = 0;
  let i = 0;
  while (rounds.length < count && sinceProgress < criteria.length) {
    const round = buildOne(criteria[i % criteria.length], rng, used);
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
