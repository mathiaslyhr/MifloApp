/**
 * Type-ahead pools for non-player Top Bins lists. Player lists keep the
 * whole-dataset footballer search; these pools give club/nation/manager/other
 * lists the same "it comes up while typing" feel without leaking any single
 * day's answers: each pool unions a broad canonical dataset with the entries
 * of EVERY list of that kind, so today's answers hide among the crowd.
 */
import {CLUBS, derivedFromData, FOOTBALLERS, MANAGERS} from '../../data/football';
import {
  dedupeByLabel,
  nameEntry,
  searchNames,
  type NameEntry,
} from '../shared/nameSearch';
import {CITIES} from './cities';
import {LIST_POOL} from './lists';
import type {TenballKind} from './types';

/** Every entry (name + aliases) across all lists of one kind. */
function listEntriesOfKind(kind: TenballKind): NameEntry[] {
  return LIST_POOL.filter(l => (l.kind ?? 'player') === kind)
    .flatMap(l => l.entries)
    .map(e => nameEntry(e.name, e.aliases, e.flagCountry));
}

// Canonical datasets come first so dedupe keeps their labels/flags; the
// list-sourced entries add historic names (Pro Vercelli, Czechoslovakia, …)
// the datasets don't carry. Memoized against OTA hydration, which mutates
// CLUBS/MANAGERS/LIST_POOL in place.
const POOLS: Record<Exclude<TenballKind, 'player'>, () => NameEntry[]> = {
  club: derivedFromData(() =>
    dedupeByLabel([
      ...CLUBS.map(c => nameEntry(c.name, [], c.country)),
      ...listEntriesOfKind('club'),
    ]),
  ),
  nation: derivedFromData(() =>
    dedupeByLabel([
      ...[...new Set(FOOTBALLERS.flatMap(f => f.nationality))].map(n =>
        nameEntry(n, [], n),
      ),
      ...listEntriesOfKind('nation'),
    ]),
  ),
  manager: derivedFromData(() =>
    dedupeByLabel([
      ...MANAGERS.map(m => nameEntry(m.name, [], m.nationality[0])),
      ...listEntriesOfKind('manager'),
    ]),
  ),
  // Cities have no canonical dataset the way clubs/nations/managers do, so a
  // curated decoy crowd (CITIES) plays that role: without it the pool is only
  // the ten answers and a player picks them all blind. Decoys come first so
  // their flag/label win the dedupe; the list answers merge in their aliases.
  other: derivedFromData(() =>
    dedupeByLabel([
      ...CITIES.map(c => nameEntry(c.name, c.aliases ?? [], c.country)),
      ...listEntriesOfKind('other'),
    ]),
  ),
};

/** Ranked suggestions for a non-player list kind. A pack can name a kind this
 *  binary predates, so fall back to `other` (list-sourced names only) instead
 *  of throwing on an undefined pool — a weaker type-ahead beats a crash. */
export function searchSuggestions(
  kind: Exclude<TenballKind, 'player'>,
  query: string,
  limit = 5,
): NameEntry[] {
  const pool = POOLS[kind] ?? POOLS.other;
  return searchNames(pool(), query, limit);
}
