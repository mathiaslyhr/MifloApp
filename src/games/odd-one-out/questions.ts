/**
 * Builds Odd One Out rounds from the shared football fact layer
 * (src/data/football). A round picks an attribute (a `Criterion`), draws three
 * players who satisfy it and one "outlier" who provably doesn't, then shuffles
 * the four. The chosen criterion is kept on the round so the answer can always
 * be re-verified — there is exactly one outlier by construction.
 *
 * Multiplayer note: generate the set ONCE per game (the host) and share it, so
 * everyone in a room gets the same rounds. `rng` is injectable so tests are
 * deterministic, mirroring src/games/quiz/questions.ts.
 */
import {
  all,
  find,
  getClub,
  matches,
  sample,
  shuffle,
  type Criterion,
  type Footballer,
  type HonourType,
  type Position,
  type Rng,
} from '../../data/football';
import type {OddCard, OddRound} from './mockData';

/** A concrete attribute three players will share. */
type AttributeSpec = {
  criterion: Criterion;
  /** Verb phrase for the reveal, e.g. "won the Champions League". */
  groupLabel: string;
  /** Header category label. */
  topic: string;
};

const HONOURS: {type: HonourType; label: string}[] = [
  {type: 'champions-league', label: 'won the Champions League'},
  {type: 'world-cup', label: 'won the World Cup'},
  {type: 'ballon-dor', label: 'have won the Ballon d’Or'},
  {type: 'european-championship', label: 'won the European Championship'},
];

const POSITION_LABELS: Record<Position, string> = {
  GK: 'are goalkeepers',
  DF: 'are defenders',
  MF: 'are midfielders',
  FW: 'are forwards',
};

function cardOf(f: Footballer): OddCard {
  return {footballerId: f.id, name: f.name};
}

/** Count distinct players per value of some key, then keep values with ≥3. */
function frequentValues<T>(
  valuesOf: (f: Footballer) => T[],
  min = 3,
): T[] {
  const counts = new Map<T, number>();
  for (const f of all()) {
    for (const v of new Set(valuesOf(f))) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, c]) => c >= min).map(([v]) => v);
}

/** Every attribute worth building a round from, given the current data. */
function attributeSpecs(): AttributeSpec[] {
  const specs: AttributeSpec[] = [];

  for (const h of HONOURS) {
    specs.push({
      criterion: {kind: 'honour', honour: h.type},
      groupLabel: h.label,
      topic: 'Honours',
    });
  }

  for (const country of frequentValues(f => f.nationality)) {
    specs.push({
      criterion: {kind: 'nationality', country},
      groupLabel: `represent ${country}`,
      topic: 'Nationality',
    });
  }

  for (const clubId of frequentValues(f => f.clubs.map(s => s.clubId))) {
    specs.push({
      criterion: {kind: 'club', clubId},
      groupLabel: `played for ${getClub(clubId)?.name ?? clubId}`,
      topic: 'Clubs',
    });
  }

  for (const position of frequentValues(f => f.positions)) {
    specs.push({
      criterion: {kind: 'position', position},
      groupLabel: POSITION_LABELS[position],
      topic: 'Positions',
    });
  }

  return specs;
}

/** Build one round from a spec, skipping players already used; null if it can't. */
function buildOne(
  spec: AttributeSpec,
  rng: Rng,
  used: Set<string>,
): OddRound | null {
  const matching = find([spec.criterion]).filter(f => !used.has(f.id));
  const outliers = all().filter(
    f => !used.has(f.id) && !matches(f, spec.criterion),
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

  return {
    cards,
    outlierIndex,
    criterion: spec.criterion,
    explanation: `Three of them ${spec.groupLabel}.`,
    topic: spec.topic,
  };
}

export type BuildOptions = {rng?: Rng};

/**
 * Generate up to `count` rounds. Each player appears in at most one round, so
 * output is capped by the pool — returns fewer rounds rather than reusing
 * players (mirrors the quiz's "fewer if the pool is too small" behaviour).
 */
export function buildRounds(count: number, options: BuildOptions = {}): OddRound[] {
  const {rng = Math.random} = options;
  const specs = shuffle(attributeSpecs(), rng);
  if (specs.length === 0) {
    return [];
  }
  const used = new Set<string>();
  const rounds: OddRound[] = [];
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
