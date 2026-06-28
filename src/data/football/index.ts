/**
 * Public surface of the football fact layer. Games import from here only.
 */
export * from './types';
export {CLUBS, getClub} from './clubs';
export {CATEGORIES, getCategory} from './categories';
export type {Category} from './categories';
export {FOOTBALLERS} from './footballers';
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
