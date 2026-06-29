/**
 * Modern players most associated with the Bundesliga. Membership is
 * organisational only — see leaguesOf; matching is derived from club spells.
 */
import type {Footballer} from '../types';

export const BUNDESLIGA: readonly Footballer[] = [
  {
    id: 'jamal-musiala',
    name: 'Jamal Musiala',
    nationality: ['Germany'],
    positions: ['MF', 'FW'],
    shirtNumbers: [10, 42],
    clubs: [{clubId: 'bayern', from: 2020}],
    honours: [],
  },
  {
    id: 'thomas-muller',
    name: 'Thomas Müller',
    nationality: ['Germany'],
    positions: ['FW', 'MF'],
    shirtNumbers: [25],
    clubs: [{clubId: 'bayern', from: 2008, to: 2025}],
    honours: [
      {type: 'champions-league', count: 2},
      {type: 'world-cup', count: 1, years: [2014]},
    ],
  },
  {
    id: 'manuel-neuer',
    name: 'Manuel Neuer',
    nationality: ['Germany'],
    positions: ['GK'],
    shirtNumbers: [1],
    clubs: [
      {clubId: 'schalke', from: 2006, to: 2011},
      {clubId: 'bayern', from: 2011},
    ],
    honours: [
      {type: 'champions-league', count: 2},
      {type: 'world-cup', count: 1, years: [2014]},
    ],
  },
  {
    id: 'joshua-kimmich',
    name: 'Joshua Kimmich',
    nationality: ['Germany'],
    positions: ['MF', 'DF'],
    shirtNumbers: [6],
    clubs: [
      {clubId: 'rb-leipzig', from: 2013, to: 2015},
      {clubId: 'bayern', from: 2015},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2020]}],
  },
];
