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
  {
    id: 'mats-hummels',
    name: 'Mats Hummels',
    nationality: ['Germany'],
    positions: ['DF'],
    shirtNumbers: [5],
    clubs: [
      {clubId: 'bayern', from: 2006, to: 2008},
      {clubId: 'dortmund', from: 2008, to: 2016},
      {clubId: 'bayern', from: 2016, to: 2019},
      {clubId: 'dortmund', from: 2019, to: 2024},
      {clubId: 'roma', from: 2024, to: 2025},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2014]}],
  },
  {
    id: 'marco-reus',
    name: 'Marco Reus',
    nationality: ['Germany'],
    positions: ['FW', 'MF'],
    shirtNumbers: [11],
    clubs: [
      {clubId: 'monchengladbach', from: 2009, to: 2012},
      {clubId: 'dortmund', from: 2012, to: 2024},
    ],
    honours: [],
  },
  {
    id: 'ilkay-gundogan',
    name: 'İlkay Gündoğan',
    nationality: ['Germany'],
    positions: ['MF'],
    shirtNumbers: [8, 19],
    clubs: [
      {clubId: 'dortmund', from: 2011, to: 2016},
      {clubId: 'man-city', from: 2016, to: 2023},
      {clubId: 'barcelona', from: 2023, to: 2024},
      {clubId: 'man-city', from: 2024},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2023]}],
  },
  {
    id: 'leroy-sane',
    name: 'Leroy Sané',
    nationality: ['Germany'],
    positions: ['FW'],
    shirtNumbers: [10],
    clubs: [
      {clubId: 'schalke', from: 2014, to: 2016},
      {clubId: 'man-city', from: 2016, to: 2020},
      {clubId: 'bayern', from: 2020},
    ],
    honours: [],
  },
  {
    id: 'serge-gnabry',
    name: 'Serge Gnabry',
    nationality: ['Germany'],
    positions: ['FW'],
    shirtNumbers: [7],
    clubs: [
      {clubId: 'arsenal', from: 2012, to: 2016},
      {clubId: 'bayern', from: 2017},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2020]}],
  },
  {
    id: 'florian-wirtz',
    name: 'Florian Wirtz',
    nationality: ['Germany'],
    positions: ['MF'],
    shirtNumbers: [10],
    clubs: [
      {clubId: 'leverkusen', from: 2020, to: 2025},
      {clubId: 'liverpool', from: 2025},
    ],
    honours: [],
  },
];
