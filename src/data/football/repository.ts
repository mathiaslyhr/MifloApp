/**
 * Query layer over the football fact database. This is the ONLY surface games
 * use — they never import the raw arrays. Today it queries in-memory arrays;
 * a future backend can replace the internals without touching game code.
 *
 * The `Criterion`-based API is deliberately game-agnostic:
 *   - quiz   → byCategory(topic) to pick a pool, then build a question
 *   - tic-tac-toe → intersection(rowCriterion, colCriterion)
 */
import {CLUBS, getClub} from './clubs';
import {getCategory} from './categories';
import {FOOTBALLERS} from './footballers';
import type {Criterion, Footballer} from './types';

export function all(): readonly Footballer[] {
  return FOOTBALLERS;
}

const BY_ID: ReadonlyMap<string, Footballer> = new Map(
  FOOTBALLERS.map(f => [f.id, f]),
);

export function getById(id: string): Footballer | undefined {
  return BY_ID.get(id);
}

/** The leagues a footballer has played in, derived from their club spells. */
export function leaguesOf(footballer: Footballer): string[] {
  const leagues = new Set<string>();
  for (const spell of footballer.clubs) {
    const club = getClub(spell.clubId);
    if (club) {
      leagues.add(club.league);
    }
  }
  return [...leagues];
}

/** Does a single footballer satisfy one criterion? */
export function matches(footballer: Footballer, criterion: Criterion): boolean {
  switch (criterion.kind) {
    case 'club':
      return footballer.clubs.some(s => s.clubId === criterion.clubId);
    case 'league':
      return leaguesOf(footballer).includes(criterion.league);
    case 'nationality':
      return footballer.nationality.includes(criterion.country);
    case 'position':
      return footballer.positions.includes(criterion.position);
    case 'honour':
      return footballer.honours.some(h => h.type === criterion.honour);
    case 'tag':
      return (footballer.tags ?? []).includes(criterion.tag);
  }
}

/** Footballers satisfying ALL criteria (AND). Empty list → everyone. */
export function find(criteria: readonly Criterion[]): Footballer[] {
  return FOOTBALLERS.filter(f => criteria.every(c => matches(f, c)));
}

/** Footballers satisfying both criteria — a tic-tac-toe cell. */
export function intersection(a: Criterion, b: Criterion): Footballer[] {
  return find([a, b]);
}

/** Footballers in a quiz category, by topic id. Unknown topic → []. */
export function byCategory(topicId: string): Footballer[] {
  const category = getCategory(topicId);
  if (!category) {
    return [];
  }
  return find(category.criteria);
}

// --- Randomness helpers (rng injectable for deterministic tests) ---

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick up to `n` distinct items at random. */
export function sample<T>(items: readonly T[], n: number, rng: Rng = Math.random): T[] {
  return shuffle(items, rng).slice(0, n);
}

export function pickRandom<T>(items: readonly T[], rng: Rng = Math.random): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

/** Convenience for distractor generation: all clubs of a given league. */
export function clubsInLeague(league: string): string[] {
  return CLUBS.filter(c => c.league === league).map(c => c.id);
}
