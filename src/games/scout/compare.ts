/**
 * The comparison core — pure functions that reduce two footballers to a row of
 * coloured feedback cells. No React, no persistence, no dataset lookups beyond
 * the read-only `getClub`/`getById` helpers, so it is fully unit-testable with
 * fixture footballers.
 *
 * The dataset has no market value / height / detailed position, so the
 * `league` column is derived from the current club. Age is computed from
 * `born` at the puzzle's `dateKey`, keeping the row deterministic per day.
 */
import {getById, getClub, type Footballer} from '../../data/football';
import type {CellResult, ColumnKey, GuessRow} from './types';

/** The five columns compared, in display order. */
export const COLUMNS: readonly ColumnKey[] = [
  'nationality',
  'position',
  'club',
  'league',
  'age',
];

/** A footballer flattened to the scalars/sets the columns actually compare. */
export type DerivedAttributes = {
  nationality: string[];
  /** Primary (first-listed) position; the data is already coarse (GK/DF/MF/FW). */
  position: string | undefined;
  /** The club with an open-ended spell (`to` undefined), i.e. the current club. */
  activeClubId: string | undefined;
  league: string | undefined;
  /** Every club the player has ever played at (loans included). */
  careerClubIds: Set<string>;
  /** Every league the player has ever played in (loans included). */
  careerLeagues: Set<string>;
  /** Whole years old on the puzzle's day. */
  age: number | undefined;
};

/** Whole-year age on `dateKey` for a `YYYY-MM-DD` date of birth. */
export function ageOn(dateKey: string, born: string): number | undefined {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [by, bm, bd] = born.split('-').map(Number);
  if ([y, m, d, by, bm, bd].some(Number.isNaN)) {
    return undefined;
  }
  const hadBirthday = m > bm || (m === bm && d >= bd);
  return y - by - (hadBirthday ? 0 : 1);
}

/** Flatten a footballer to the values the feedback columns compare. */
export function deriveAttributes(f: Footballer, dateKey: string): DerivedAttributes {
  // Current club = the open-ended spell, else the most recent (last) spell —
  // matching FootballerCard. Many current players have their current spell
  // end-dated (e.g. `to: 2025`), so relying only on `to === undefined` would
  // leave them with no club/league (League/Club columns could never match).
  const active =
    f.clubs.find(s => s.to === undefined) ?? f.clubs[f.clubs.length - 1];
  const activeClubId = active?.clubId;
  const league = activeClubId ? getClub(activeClubId)?.league : undefined;
  // Whole career (loans included) so a former club/league can turn yellow.
  const careerClubIds = new Set(f.clubs.map(s => s.clubId));
  const careerLeagues = new Set<string>();
  for (const clubId of careerClubIds) {
    const l = getClub(clubId)?.league;
    if (l !== undefined) {
      careerLeagues.add(l);
    }
  }
  return {
    nationality: f.nationality,
    position: f.positions[0],
    activeClubId,
    league,
    careerClubIds,
    careerLeagues,
    age: ageOn(dateKey, f.born),
  };
}

/** Direction of a numeric miss: 'up' means the secret's value is higher. */
function numeric(
  key: ColumnKey,
  guess: number | undefined,
  secret: number | undefined,
): CellResult {
  if (guess === undefined || secret === undefined) {
    return {key, status: 'miss'};
  }
  if (guess === secret) {
    return {key, status: 'hit'};
  }
  return {key, status: 'miss', direction: secret > guess ? 'up' : 'down'};
}

/** Compare one column of a guess against the secret. */
export function compareCell(
  key: ColumnKey,
  guess: DerivedAttributes,
  secret: DerivedAttributes,
): CellResult {
  switch (key) {
    case 'nationality': {
      const g = new Set(guess.nationality);
      const s = new Set(secret.nationality);
      const equal =
        g.size === s.size && [...g].every(n => s.has(n));
      if (equal) {
        return {key, status: 'hit'};
      }
      const intersects = [...g].some(n => s.has(n));
      return {key, status: intersects ? 'partial' : 'miss'};
    }
    case 'position':
      return {
        key,
        status:
          guess.position !== undefined && guess.position === secret.position
            ? 'hit'
            : 'miss',
      };
    case 'club': {
      // Green for the exact current club; yellow if the secret has ever played
      // at the guess's current club (a former club of the secret); else grey.
      if (guess.activeClubId === undefined) {
        return {key, status: 'miss'};
      }
      if (guess.activeClubId === secret.activeClubId) {
        return {key, status: 'hit'};
      }
      return {
        key,
        status: secret.careerClubIds.has(guess.activeClubId) ? 'partial' : 'miss',
      };
    }
    case 'league': {
      // Green for the exact current league; yellow if the secret has ever played
      // in the guess's current league; else grey.
      if (guess.league === undefined) {
        return {key, status: 'miss'};
      }
      if (guess.league === secret.league) {
        return {key, status: 'hit'};
      }
      return {
        key,
        status: secret.careerLeagues.has(guess.league) ? 'partial' : 'miss',
      };
    }
    case 'age':
      return numeric(key, guess.age, secret.age);
  }
}

/** Compare two derived-attribute views across every column. */
export function compareAttributes(
  guess: DerivedAttributes,
  secret: DerivedAttributes,
): CellResult[] {
  return COLUMNS.map(key => compareCell(key, guess, secret));
}

/**
 * Compare a guessed footballer against the secret, both by id. Throws if either
 * id is unknown (the caller only ever passes ids from the dataset).
 */
export function compareFootballers(
  guessId: string,
  secretId: string,
  dateKey: string,
): GuessRow {
  const guess = getById(guessId);
  const secret = getById(secretId);
  if (!guess || !secret) {
    throw new Error(`Unknown footballer id: ${!guess ? guessId : secretId}`);
  }
  return {
    footballerId: guessId,
    cells: compareAttributes(
      deriveAttributes(guess, dateKey),
      deriveAttributes(secret, dateKey),
    ),
  };
}
