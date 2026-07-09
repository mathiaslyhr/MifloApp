/**
 * Public surface of the football fact layer. Games import from here only.
 */
export * from './types';
export {CLUBS, getClub} from './clubs';
export {derivedFromData} from './generation';
export {CATEGORIES, getCategory} from './categories';
export type {Category} from './categories';
export {FOOTBALLERS} from './footballers';
export {MANAGERS} from './managers';
export {TREBLE_SQUADS, TREBLE_WINNER_IDS} from './trebles';
export type {TrebleSquad} from './trebles';
export {FAMOUS_LINEUPS} from './famousLineups';
export type {FamousLineup, LineupPlayer} from './famousLineups';
export {
  all,
  getById,
  leaguesOf,
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
