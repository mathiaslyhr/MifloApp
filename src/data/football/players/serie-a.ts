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
  {
    id: 'paulo-dybala',
    name: 'Paulo Dybala',
    nationality: ['Argentina'],
    positions: ['FW'],
    shirtNumbers: [10, 21],
    clubs: [
      {clubId: 'juventus', from: 2015, to: 2022},
      {clubId: 'roma', from: 2022},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
  {
    id: 'nicolo-barella',
    name: 'Nicolò Barella',
    nationality: ['Italy'],
    positions: ['MF'],
    shirtNumbers: [23],
    clubs: [{clubId: 'inter', from: 2019}],
    honours: [{type: 'european-championship', count: 1, years: [2020]}],
  },
  {
    id: 'gianluigi-donnarumma',
    name: 'Gianluigi Donnarumma',
    nationality: ['Italy'],
    positions: ['GK'],
    shirtNumbers: [1, 99],
    clubs: [
      {clubId: 'ac-milan', from: 2015, to: 2021},
      {clubId: 'psg', from: 2021},
    ],
    honours: [
      {type: 'champions-league', count: 1, years: [2025]},
      {type: 'european-championship', count: 1, years: [2020]},
    ],
  },
  {
    id: 'leonardo-bonucci',
    name: 'Leonardo Bonucci',
    nationality: ['Italy'],
    positions: ['DF'],
    shirtNumbers: [19],
    clubs: [
      {clubId: 'juventus', from: 2010, to: 2017},
      {clubId: 'ac-milan', from: 2017, to: 2018},
      {clubId: 'juventus', from: 2018, to: 2023},
    ],
    honours: [{type: 'european-championship', count: 1, years: [2020]}],
  },
  {
    id: 'giorgio-chiellini',
    name: 'Giorgio Chiellini',
    nationality: ['Italy'],
    positions: ['DF'],
    shirtNumbers: [3],
    clubs: [{clubId: 'juventus', from: 2005, to: 2022}],
    honours: [{type: 'european-championship', count: 1, years: [2020]}],
  },
  {
    id: 'ciro-immobile',
    name: 'Ciro Immobile',
    nationality: ['Italy'],
    positions: ['FW'],
    shirtNumbers: [17],
    clubs: [
      {clubId: 'dortmund', from: 2014, to: 2015},
      {clubId: 'sevilla', from: 2015, to: 2016},
      {clubId: 'lazio', from: 2016, to: 2024},
    ],
    honours: [],
  },
  {
    id: 'dusan-vlahovic',
    name: 'Dušan Vlahović',
    nationality: ['Serbia'],
    positions: ['FW'],
    shirtNumbers: [9],
    clubs: [
      {clubId: 'fiorentina', from: 2018, to: 2022},
      {clubId: 'juventus', from: 2022},
    ],
    honours: [],
  },
  {
    id: 'khvicha-kvaratskhelia',
    name: 'Khvicha Kvaratskhelia',
    nationality: ['Georgia'],
    positions: ['FW'],
    shirtNumbers: [7, 77],
    clubs: [
      {clubId: 'napoli', from: 2022, to: 2025},
      {clubId: 'psg', from: 2025},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2025]}],
  },
];
