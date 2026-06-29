/**
 * Modern players most associated with Serie A. Membership is organisational
 * only — see leaguesOf; category matching is derived from club spells.
 */
import type {Footballer} from '../types';

export const SERIE_A: readonly Footballer[] = [
  {
    id: 'lautaro-martinez',
    name: 'Lautaro Martínez',
    nationality: ['Argentina'],
    positions: ['FW'],
    shirtNumbers: [10],
    clubs: [{clubId: 'inter', from: 2018}],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
  {
    id: 'victor-osimhen',
    name: 'Victor Osimhen',
    nationality: ['Nigeria'],
    positions: ['FW'],
    shirtNumbers: [9],
    clubs: [
      {clubId: 'lille', from: 2019, to: 2020},
      {clubId: 'napoli', from: 2020, to: 2024},
      {clubId: 'galatasaray', from: 2024, to: 2025, loan: true},
    ],
    honours: [],
  },
  {
    id: 'federico-chiesa',
    name: 'Federico Chiesa',
    nationality: ['Italy'],
    positions: ['FW'],
    shirtNumbers: [14],
    clubs: [
      {clubId: 'fiorentina', from: 2016, to: 2020},
      {clubId: 'juventus', from: 2020, to: 2024},
      {clubId: 'liverpool', from: 2024},
    ],
    honours: [{type: 'european-championship', count: 1, years: [2020]}],
  },
  {
    id: 'rafael-leao',
    name: 'Rafael Leão',
    nationality: ['Portugal'],
    positions: ['FW'],
    shirtNumbers: [10],
    clubs: [
      {clubId: 'sporting', from: 2017, to: 2018},
      {clubId: 'lille', from: 2018, to: 2019},
      {clubId: 'ac-milan', from: 2019},
    ],
    honours: [],
  },
];
