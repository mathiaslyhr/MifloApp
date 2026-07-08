/**
 * Query layer over the football fact database. This is the ONLY surface games
 * use — they never import the raw arrays. Today it queries in-memory arrays;
 * a future backend can replace the internals without touching game code.
 *
 * The `Criterion`-based API is deliberately game-agnostic:
 *   - quiz   → byCategory(topic) to pick a pool, then build a question
 *   - hattrick → intersection(rowCriterion, colCriterion)
 */
import {CLUBS, getClub} from './clubs';
import {getCategory} from './categories';
import {FOOTBALLERS} from './footballers';
import {TREBLE_WINNER_IDS} from './trebles';
import type {ClubSpell, Criterion, Footballer} from './types';

/** Year used as the open end of a still-active club spell (`to` undefined). */
const CURRENT_YEAR = new Date().getFullYear();

/** The "top-5" European leagues (by club league id). */
const TOP5_LEAGUES = new Set([
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
]);

/** Do two club spells (same club) overlap in time? Open ends are handled. */
function spellsOverlap(a: ClubSpell, b: ClubSpell): boolean {
  const aFrom = a.from ?? -Infinity;
  const aTo = a.to ?? CURRENT_YEAR;
  const bFrom = b.from ?? -Infinity;
  const bTo = b.to ?? CURRENT_YEAR;
  return Math.max(aFrom, bFrom) <= Math.min(aTo, bTo);
}

/** Were two footballers at the same club during overlapping years? */
function wereTeammates(a: Footballer, b: Footballer): boolean {
  if (a.id === b.id) {
    return false;
  }
  for (const sa of a.clubs) {
    for (const sb of b.clubs) {
      if (sa.clubId === sb.clubId && spellsOverlap(sa, sb)) {
        return true;
      }
    }
  }
  return false;
}

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
    case 'shirtNumber':
      return (footballer.shirtNumbers ?? []).includes(criterion.number);
    case 'teammate': {
      const target = getById(criterion.playerId);
      return target ? wereTeammates(footballer, target) : false;
    }
    case 'topLeagues': {
      const count = leaguesOf(footballer).filter(l => TOP5_LEAGUES.has(l)).length;
      return count >= criterion.count;
    }
    case 'leagueTitle': {
      // Won THIS league: a league-title year that overlaps a spell at a club
      // playing in it. Honours without years can't be attributed — no match.
      const years = footballer.honours
        .filter(h => h.type === 'league-title')
        .flatMap(h => h.years ?? []);
      return years.some(year =>
        footballer.clubs.some(spell => {
          if (spell.from != null && year < spell.from) {
            return false;
          }
          if (spell.to != null && year > spell.to) {
            return false;
          }
          return getClub(spell.clubId)?.league === criterion.league;
        }),
      );
    }
    case 'treble':
      return TREBLE_WINNER_IDS.has(footballer.id);
  }
}

/** Footballers satisfying ALL criteria (AND). Empty list → everyone. */
export function find(criteria: readonly Criterion[]): Footballer[] {
  return FOOTBALLERS.filter(f => criteria.every(c => matches(f, c)));
}

/** Footballers satisfying both criteria — a hattrick cell. */
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
