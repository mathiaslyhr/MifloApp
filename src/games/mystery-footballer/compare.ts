/**
 * The comparison core — pure functions that reduce two footballers to a row of
 * coloured feedback cells. No React, no persistence, no dataset lookups beyond
 * the read-only `getClub`/`getById` helpers, so it is fully unit-testable with
 * fixture footballers.
 *
 * The dataset has no age / market value / height / detailed position, so two of
 * the six columns are derived: `league` (from the current club) and `era` (the
 * earliest year across all club spells — the substitute for an age axis).
 */
import {getById, getClub, type Footballer} from '../../data/football';
import type {CellResult, ColumnKey, GuessRow} from './types';

/** The six columns compared, in display order. */
export const COLUMNS: readonly ColumnKey[] = [
  'nationality',
  'position',
  'club',
  'league',
  'shirtNumber',
  'era',
];

/** A footballer flattened to the scalars/sets the columns actually compare. */
export type DerivedAttributes = {
  nationality: string[];
  /** Primary (first-listed) position; the data is already coarse (GK/DF/MF/FW). */
  position: string | undefined;
  /** The club with an open-ended spell (`to` undefined), i.e. the current club. */
  activeClubId: string | undefined;
  league: string | undefined;
  /** Primary shirt number. */
  shirtNumber: number | undefined;
  /** Earliest year across all club spells — the "era"/debut proxy. */
  careerStartYear: number | undefined;
};

/** Flatten a footballer to the values the feedback columns compare. */
export function deriveAttributes(f: Footballer): DerivedAttributes {
  const active = f.clubs.find(s => s.to === undefined);
  const activeClubId = active?.clubId;
  const league = activeClubId ? getClub(activeClubId)?.league : undefined;
  const froms = f.clubs
    .map(s => s.from)
    .filter((y): y is number => typeof y === 'number');
  return {
    nationality: f.nationality,
    position: f.positions[0],
    activeClubId,
    league,
    shirtNumber: f.shirtNumbers?.[0],
    careerStartYear: froms.length ? Math.min(...froms) : undefined,
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
      if (guess.activeClubId && guess.activeClubId === secret.activeClubId) {
        return {key, status: 'hit'};
      }
      if (
        guess.league &&
        secret.league &&
        guess.league === secret.league
      ) {
        // Right league, wrong club.
        return {key, status: 'partial'};
      }
      return {key, status: 'miss'};
    }
    case 'league':
      return {
        key,
        status:
          guess.league !== undefined && guess.league === secret.league
            ? 'hit'
            : 'miss',
      };
    case 'shirtNumber':
      return numeric(key, guess.shirtNumber, secret.shirtNumber);
    case 'era':
      return numeric(key, guess.careerStartYear, secret.careerStartYear);
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
export function compareFootballers(guessId: string, secretId: string): GuessRow {
  const guess = getById(guessId);
  const secret = getById(secretId);
  if (!guess || !secret) {
    throw new Error(`Unknown footballer id: ${!guess ? guessId : secretId}`);
  }
  return {
    footballerId: guessId,
    cells: compareAttributes(deriveAttributes(guess), deriveAttributes(secret)),
  };
}
