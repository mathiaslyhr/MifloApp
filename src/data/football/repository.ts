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
import {continentOf} from './continents';
import {FOOTBALLERS} from './footballers';
import {derivedFromData} from './generation';
import {MANAGERS} from './managers';
import {TREBLE_WINNER_IDS} from './trebles';
import type {ClubSpell, Criterion, Footballer, Manager} from './types';

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

/**
 * Did a footballer play under a manager? True when one of the player's club
 * spells overlaps a managerial spell at the SAME club. National-team spells are
 * ignored — we can't tell from `nationality` when a player was actually called
 * up, so counting them would produce false "managed by" matches.
 */
function wasManagedBy(footballer: Footballer, manager: Manager): boolean {
  for (const job of manager.spells) {
    if (job.clubId == null) {
      continue;
    }
    const managerSpell: ClubSpell = {
      clubId: job.clubId,
      from: job.from,
      to: job.to,
    };
    for (const spell of footballer.clubs) {
      if (spell.clubId === job.clubId && spellsOverlap(spell, managerSpell)) {
        return true;
      }
    }
  }
  return false;
}

/** The distinct countries of the clubs a footballer has played for. */
export function clubCountriesOf(footballer: Footballer): string[] {
  const countries = new Set<string>();
  for (const spell of footballer.clubs) {
    const club = getClub(spell.clubId);
    if (club) {
      countries.add(club.country);
    }
  }
  return [...countries];
}

/** True if the footballer played for exactly one club (loans don't count). */
function isOneClub(footballer: Footballer): boolean {
  const clubs = new Set(
    footballer.clubs.filter(s => !s.loan).map(s => s.clubId),
  );
  return clubs.size === 1;
}

/** The decade a footballer was born in (e.g. 1993 → 1990); NaN if unparseable. */
function bornDecadeOf(footballer: Footballer): number {
  const year = Number.parseInt(footballer.born.slice(0, 4), 10);
  return Number.isNaN(year) ? NaN : Math.floor(year / 10) * 10;
}

export function all(): readonly Footballer[] {
  return FOOTBALLERS;
}

const byId = derivedFromData(
  (): ReadonlyMap<string, Footballer> => new Map(FOOTBALLERS.map(f => [f.id, f])),
);

export function getById(id: string): Footballer | undefined {
  return byId().get(id);
}

const managerById = derivedFromData(
  (): ReadonlyMap<string, Manager> => new Map(MANAGERS.map(m => [m.id, m])),
);

export function getManagerById(id: string): Manager | undefined {
  return managerById().get(id);
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
    case 'bornDecade':
      return bornDecadeOf(footballer) === criterion.decade;
    case 'oneClub':
      return isOneClub(footballer);
    case 'honourYear':
      return footballer.honours.some(
        h =>
          h.type === criterion.honour &&
          (h.years ?? []).includes(criterion.year),
      );
    case 'playedInCountry':
      return clubCountriesOf(footballer).includes(criterion.country);
    case 'continent':
      return footballer.nationality.some(
        c => continentOf(c) === criterion.continent,
      );
    case 'managedBy': {
      const manager = getManagerById(criterion.managerId);
      return manager ? wasManagedBy(footballer, manager) : false;
    }
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
