/**
 * Generates quiz questions from the shared football fact layer
 * (src/data/football). The quiz only knows about `Criterion`-defined
 * categories and the fact database — it owns no player data of its own.
 *
 * The templates aim for "cool & hard" over trivia-easy: intersections ("played
 * for BOTH X and Y"), reverse lookups ("which player played for X"),
 * superlatives ("most Champions Leagues") and year trivia ("Ballon d'Or in Y").
 * Each template guarantees exactly one correct option by drawing distractors
 * that provably fail the same predicate, so output is always valid.
 *
 * Multiplayer note: generate the set ONCE per game (the host) and share it, so
 * everyone in a room gets the same questions while separate games differ. `rng`
 * is injectable so tests are deterministic.
 */
import {
  all,
  byCategory,
  CLUBS,
  getClub,
  HONOUR_COUNT_LABELS,
  HONOUR_LABELS,
  matches,
  pickRandom,
  sample,
  shuffle,
  type Footballer,
  type HonourType,
  type Rng,
} from '../../data/football';
import type {Question} from './mockData';

/** Honours specific and famous enough to make a clean question. */
const COUNTABLE_HONOURS: HonourType[] = [
  'champions-league',
  'world-cup',
  'ballon-dor',
  'european-championship',
];

/** Honours where "has X won it?" reads naturally. */
const TROPHY_HONOURS: HonourType[] = ['world-cup', 'champions-league'];

function honourCountOf(f: Footballer, type: HonourType): number {
  return f.honours.find(h => h.type === type)?.count ?? 0;
}

/** Build 4 unique options from a correct answer + candidate distractors. */
function makeOptions(
  correct: string,
  distractors: string[],
  rng: Rng,
): {options: string[]; correctIndex: number} | null {
  const unique = [...new Set(distractors.filter(d => d !== correct))];
  if (unique.length < 3) {
    return null;
  }
  const options = shuffle([correct, ...sample(unique, 3, rng)], rng);
  return {options, correctIndex: options.indexOf(correct)};
}

/**
 * Names of other footballers to use as wrong answers. `alsoTrue` flags players
 * who would ALSO be a correct answer — they're excluded so there's exactly one.
 */
function otherPlayerNames(
  correct: Footballer,
  alsoTrue: (f: Footballer) => boolean,
): string[] {
  return all()
    .filter(p => p.id !== correct.id && !alsoTrue(p))
    .map(p => p.name);
}

type Template = (f: Footballer, rng: Rng) => Question | null;

/** "Which of these clubs has X played for?" — options are clubs. */
const clubPlayedFor: Template = (f, rng) => {
  const ownClubIds = new Set(f.clubs.map(s => s.clubId));
  const correctId = pickRandom([...ownClubIds], rng);
  const club = correctId ? getClub(correctId) : undefined;
  if (!club) {
    return null;
  }
  const distractors = CLUBS.filter(c => !ownClubIds.has(c.id)).map(c => c.name);
  const built = makeOptions(club.name, distractors, rng);
  return built && {topic: 'Clubs', prompt: `Which of these clubs has ${f.name} played for?`, ...built};
};

/** "Which of these players played for [club]?" — options are players. */
const reversePlayedFor: Template = (f, rng) => {
  const clubId = pickRandom(f.clubs.map(s => s.clubId), rng);
  if (!clubId) {
    return null;
  }
  const club = getClub(clubId);
  if (!club) {
    return null;
  }
  const distractors = otherPlayerNames(
    f,
    p => matches(p, {kind: 'club', clubId}),
  );
  const built = makeOptions(f.name, distractors, rng);
  return built && {topic: 'Career', prompt: `Which of these players played for ${club.name}?`, ...built};
};

/** "Which player played for BOTH [A] and [B]?" — the tic-tac-toe flavour. */
const bothClubs: Template = (f, rng) => {
  const clubIds = [...new Set(f.clubs.map(s => s.clubId))];
  if (clubIds.length < 2) {
    return null;
  }
  const [aId, bId] = sample(clubIds, 2, rng);
  const a = getClub(aId);
  const b = getClub(bId);
  if (!a || !b) {
    return null;
  }
  const distractors = otherPlayerNames(
    f,
    p =>
      matches(p, {kind: 'club', clubId: aId}) &&
      matches(p, {kind: 'club', clubId: bId}),
  );
  const built = makeOptions(f.name, distractors, rng);
  return built && {topic: 'Career', prompt: `Which player played for both ${a.name} and ${b.name}?`, ...built};
};

/** "Which of these players has won the [World Cup/Champions League]?" */
const wonTrophy: Template = (f, rng) => {
  const have = f.honours.filter(h => TROPHY_HONOURS.includes(h.type));
  const honour = pickRandom(have, rng);
  if (!honour) {
    return null;
  }
  const distractors = otherPlayerNames(
    f,
    p => matches(p, {kind: 'honour', honour: honour.type}),
  );
  const built = makeOptions(f.name, distractors, rng);
  return built && {topic: 'Honours', prompt: `Which of these players has won the ${HONOUR_LABELS[honour.type]}?`, ...built};
};

/** "Which of these players has won the most [Champions Leagues]?" */
const mostTitles: Template = (f, rng) => {
  const countable = f.honours.filter(
    h => COUNTABLE_HONOURS.includes(h.type) && (h.count ?? 0) >= 2,
  );
  const honour = pickRandom(countable, rng);
  if (!honour || honour.count === undefined) {
    return null;
  }
  const count = honour.count;
  // Distractors all have strictly fewer, so the subject is the unique maximum.
  const distractors = otherPlayerNames(
    f,
    p => honourCountOf(p, honour.type) >= count,
  );
  const built = makeOptions(f.name, distractors, rng);
  return built && {topic: 'Honours', prompt: `Which of these players has won the most ${HONOUR_COUNT_LABELS[honour.type]}?`, ...built};
};

/** "Who won the Ballon d'Or in [year]?" — distractors are other winners. */
const ballonDorYear: Template = (f, rng) => {
  const bd = f.honours.find(h => h.type === 'ballon-dor');
  const year = bd?.years ? pickRandom(bd.years, rng) : undefined;
  if (year === undefined) {
    return null;
  }
  const distractors = otherPlayerNames(
    f,
    p => !p.honours.some(h => h.type === 'ballon-dor'),
  );
  const built = makeOptions(f.name, distractors, rng);
  return built && {topic: 'Honours', prompt: `Who won the Ballon d'Or in ${year}?`, ...built};
};

/** "How many [Champions Leagues] has X won?" — numeric options. */
const honourCount: Template = (f, rng) => {
  const withCount = f.honours.filter(
    h => (h.count ?? 0) > 0 && COUNTABLE_HONOURS.includes(h.type),
  );
  const honour = pickRandom(withCount, rng);
  if (!honour || honour.count === undefined) {
    return null;
  }
  const candidates = [
    honour.count + 1,
    honour.count - 1,
    honour.count + 2,
    honour.count + 3,
  ].filter(n => n >= 0);
  const built = makeOptions(String(honour.count), candidates.map(String), rng);
  return built && {topic: 'Honours', prompt: `How many ${HONOUR_COUNT_LABELS[honour.type]} has ${f.name} won?`, ...built};
};

/** "What shirt number does X wear?" — only for players with a single known
 *  number, so there's exactly one correct answer. Distractors are real numbers
 *  worn elsewhere (never this player's). */
const shirtNumber: Template = (f, rng) => {
  if (!f.shirtNumbers || f.shirtNumbers.length !== 1) {
    return null;
  }
  const own = new Set(f.shirtNumbers);
  const correct = f.shirtNumbers[0];
  const pool = [
    ...new Set(all().flatMap(p => p.shirtNumbers ?? [])),
  ].filter(n => !own.has(n));
  const built = makeOptions(String(correct), pool.map(String), rng);
  return built && {topic: 'Shirt', prompt: `What shirt number does ${f.name} wear?`, ...built};
};

/** "Which club does X play for now?" — correct is the open (current) spell.
 *  Skips retired players and anyone with an ambiguous current club. */
const currentClub: Template = (f, rng) => {
  const open = f.clubs.filter(s => s.to === undefined && !s.loan);
  if (open.length !== 1) {
    return null;
  }
  const club = getClub(open[0].clubId);
  if (!club) {
    return null;
  }
  const own = new Set(f.clubs.map(s => s.clubId));
  const distractors = CLUBS.filter(c => !own.has(c.id)).map(c => c.name);
  const built = makeOptions(club.name, distractors, rng);
  return built && {topic: 'Clubs', prompt: `Which club does ${f.name} play for now?`, ...built};
};

/** "Which club did X play for in [year]?" — only picks years covered by exactly
 *  one spell, so loan/transfer overlaps can't create a second correct answer. */
const clubInYear: Template = (f, rng) => {
  const covers = (s: {from?: number; to?: number}, y: number): boolean =>
    (s.from ?? -Infinity) <= y && y <= (s.to ?? Infinity);
  const years = new Set<number>();
  for (const s of f.clubs) {
    if (s.from === undefined) {
      continue;
    }
    // For an open spell, only its start year is a fair "in [year]" target.
    for (let y = s.from; y <= (s.to ?? s.from); y++) {
      years.add(y);
    }
  }
  const unambiguous = [...years].filter(
    y => f.clubs.filter(s => covers(s, y)).length === 1,
  );
  const year = pickRandom(unambiguous, rng);
  if (year === undefined) {
    return null;
  }
  const spell = f.clubs.find(s => covers(s, year));
  const club = spell && getClub(spell.clubId);
  if (!club) {
    return null;
  }
  const own = new Set(f.clubs.map(s => s.clubId));
  const distractors = CLUBS.filter(c => !own.has(c.id)).map(c => c.name);
  const built = makeOptions(club.name, distractors, rng);
  return built && {topic: 'Career', prompt: `Which club did ${f.name} play for in ${year}?`, ...built};
};

/** "How many [competition] goals did X score in [season]?" — the hard, stat-led
 *  template. Numeric options spread around the real figure. */
const seasonGoals: Template = (f, rng) => {
  const withGoals = (f.seasonStats ?? []).filter(s => s.goals !== undefined);
  const stat = pickRandom(withGoals, rng);
  if (!stat || stat.goals === undefined) {
    return null;
  }
  const goals = stat.goals;
  const numbers = [-3, -5, -7, +4, +6, +9, -10]
    .map(d => goals + d)
    .filter(n => n >= 0 && n !== goals);
  const competition = stat.competition ?? 'league';
  const built = makeOptions(String(goals), numbers.map(String), rng);
  return built && {topic: 'Stats', prompt: `How many ${competition} goals did ${f.name} score in ${stat.season}?`, ...built};
};

const TEMPLATES: Template[] = [
  bothClubs,
  reversePlayedFor,
  wonTrophy,
  mostTitles,
  ballonDorYear,
  clubPlayedFor,
  honourCount,
  shirtNumber,
  currentClub,
  clubInYear,
  seasonGoals,
];

/**
 * Deduped union of footballers across the given topics (empty → all),
 * minus any excluded footballer ids (used to keep a new round fresh).
 */
function poolFor(
  topicIds: readonly string[],
  exclude: ReadonlySet<string>,
): Footballer[] {
  const ids = topicIds.length ? topicIds : ['all'];
  const pool = new Map<string, Footballer>();
  for (const id of ids) {
    for (const f of byCategory(id)) {
      if (!exclude.has(f.id)) {
        pool.set(f.id, f);
      }
    }
  }
  return [...pool.values()];
}

/** Every valid (footballer × template) question for the given topics. */
function candidates(
  topicIds: readonly string[],
  rng: Rng,
  exclude: ReadonlySet<string>,
): Question[] {
  const out: Question[] = [];
  for (const f of poolFor(topicIds, exclude)) {
    for (const template of TEMPLATES) {
      const q = template(f, rng);
      if (q) {
        out.push({...q, footballerId: f.id});
      }
    }
  }
  return out;
}

const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

export type BuildOptions = {
  rng?: Rng;
  /** Footballer ids to skip — pass last round's players to keep it fresh. */
  exclude?: ReadonlySet<string>;
};

/**
 * How many distinct questions the selected topics can produce. Drives the
 * "X questions match your topics" hint. Deterministic — independent of rng.
 */
export function countMatchingQuestions(topicIds: readonly string[]): number {
  return candidates(topicIds, Math.random, NO_EXCLUSIONS).length;
}

/**
 * Pick `count` questions favouring variety: at most one question per footballer
 * until the distinct-player pool is exhausted, then backfill. Input is assumed
 * pre-shuffled so the selection stays random.
 */
function pickDiverse(questions: readonly Question[], count: number): Question[] {
  const seen = new Set<string>();
  const firstPerPlayer: Question[] = [];
  const overflow: Question[] = [];
  for (const q of questions) {
    if (q.footballerId && !seen.has(q.footballerId)) {
      seen.add(q.footballerId);
      firstPerPlayer.push(q);
    } else {
      overflow.push(q);
    }
  }
  return [...firstPerPlayer, ...overflow].slice(0, count);
}

/**
 * Generate up to `count` random questions for the given topics. Returns fewer
 * if the pool is too small (see countMatchingQuestions). Within a round we
 * prefer distinct players so a game doesn't fixate on one footballer.
 *
 * For a "play again" round, pass `exclude` with the footballer ids from the
 * previous round (see usedFootballers) so most/all questions are about new
 * players until the pool is exhausted.
 */
export function buildQuestions(
  topicIds: readonly string[],
  count: number,
  options: BuildOptions = {},
): Question[] {
  const {rng = Math.random, exclude = NO_EXCLUSIONS} = options;
  const shuffled = shuffle(candidates(topicIds, rng, exclude), rng);
  return pickDiverse(shuffled, count);
}

/** Footballer ids covered by a question set — feed into the next round's exclude. */
export function usedFootballers(questions: readonly Question[]): Set<string> {
  return new Set(
    questions
      .map(q => q.footballerId)
      .filter((id): id is string => id !== undefined),
  );
}
