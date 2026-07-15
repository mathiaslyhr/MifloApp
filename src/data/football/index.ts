/**
 * Public surface of the football fact layer. Games import from here only.
 */
export * from './types';
export {CLUBS, getClub} from './clubs';
export {derivedFromData, subscribeGeneration} from './generation';
export {usePlayerCount} from './usePlayerCount';
export {CATEGORIES, getCategory} from './categories';
export type {Category} from './categories';
export {FOOTBALLERS} from './footballers';
export {MANAGERS} from './managers';
export {CONTINENTS, continentOf} from './continents';
export {matchmakingFacts} from './facts';
export type {Fact} from './facts';
export {TREBLE_SQUADS, TREBLE_WINNER_IDS} from './trebles';
export type {TrebleSquad} from './trebles';
export {
  COMPETITION_KEYS,
  FAMOUS_LINEUPS,
  getLineupById,
  isTeamsheetLineup,
} from './famousLineups';
export type {
  CompetitionKey,
  FamousLineup,
  FamousLineupMatch,
  LineupPlayer,
} from './famousLineups';
export {
  all,
  getById,
  getManagerById,
  leaguesOf,
  clubCountriesOf,
  matches,
  find,
  intersection,
  byCategory,
  shuffle,
  sample,
  pickRandom,
  clubsInLeague,
} from './repository';
export type {Rng} from './repository';
