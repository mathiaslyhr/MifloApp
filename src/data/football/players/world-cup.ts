/**
 * World Cup winners / international stars whose primary identity isn't a single
 * current top-five league (e.g. Argentina's 2022 winners spread across clubs).
 * Membership is organisational only — see leaguesOf.
 */
import type {Footballer} from '../types';

export const WORLD_CUP: readonly Footballer[] = [
  {
    id: 'neymar',
    name: 'Neymar',
    nationality: ['Brazil'],
    positions: ['FW'],
    shirtNumbers: [10, 11],
    clubs: [
      {clubId: 'santos', from: 2009, to: 2013},
      {clubId: 'barcelona', from: 2013, to: 2017},
      {clubId: 'psg', from: 2017, to: 2023},
      {clubId: 'al-hilal', from: 2023, to: 2025},
      {clubId: 'santos', from: 2025},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2015]}],
  },
  {
    id: 'angel-di-maria',
    name: 'Ángel Di María',
    nationality: ['Argentina'],
    positions: ['FW', 'MF'],
    shirtNumbers: [11],
    clubs: [
      {clubId: 'benfica', from: 2007, to: 2010},
      {clubId: 'real-madrid', from: 2010, to: 2014},
      {clubId: 'man-utd', from: 2014, to: 2015},
      {clubId: 'psg', from: 2015, to: 2022},
      {clubId: 'juventus', from: 2022, to: 2023},
      {clubId: 'benfica', from: 2023},
    ],
    honours: [
      {type: 'champions-league', count: 1, years: [2014]},
      {type: 'world-cup', count: 1, years: [2022]},
    ],
  },
  {
    id: 'julian-alvarez',
    name: 'Julián Álvarez',
    nationality: ['Argentina'],
    positions: ['FW'],
    shirtNumbers: [9],
    clubs: [
      {clubId: 'river-plate', from: 2018, to: 2022},
      {clubId: 'man-city', from: 2022, to: 2024},
      {clubId: 'atletico-madrid', from: 2024},
    ],
    honours: [
      {type: 'champions-league', count: 1, years: [2023]},
      {type: 'world-cup', count: 1, years: [2022]},
    ],
  },
  {
    id: 'emiliano-martinez',
    name: 'Emiliano Martínez',
    nationality: ['Argentina'],
    positions: ['GK'],
    shirtNumbers: [23],
    clubs: [
      {clubId: 'arsenal', from: 2010, to: 2020},
      {clubId: 'aston-villa', from: 2020},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
  {
    id: 'rodrigo-de-paul',
    name: 'Rodrigo De Paul',
    nationality: ['Argentina'],
    positions: ['MF'],
    shirtNumbers: [7],
    clubs: [
      {clubId: 'valencia', from: 2014, to: 2016},
      {clubId: 'atletico-madrid', from: 2021},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
  {
    id: 'enzo-fernandez',
    name: 'Enzo Fernández',
    nationality: ['Argentina'],
    positions: ['MF'],
    shirtNumbers: [5, 8],
    clubs: [
      {clubId: 'river-plate', from: 2019, to: 2022},
      {clubId: 'benfica', from: 2022, to: 2023},
      {clubId: 'chelsea', from: 2023},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
  {
    id: 'alexis-mac-allister',
    name: 'Alexis Mac Allister',
    nationality: ['Argentina'],
    positions: ['MF'],
    shirtNumbers: [10],
    clubs: [
      {clubId: 'boca-juniors', from: 2016, to: 2019},
      {clubId: 'liverpool', from: 2023},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
  {
    id: 'cristian-romero',
    name: 'Cristian Romero',
    nationality: ['Argentina'],
    positions: ['DF'],
    shirtNumbers: [17],
    clubs: [
      {clubId: 'atalanta', from: 2019, to: 2021},
      {clubId: 'tottenham', from: 2021},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
  {
    id: 'nicolas-otamendi',
    name: 'Nicolás Otamendi',
    nationality: ['Argentina'],
    positions: ['DF'],
    shirtNumbers: [19],
    clubs: [
      {clubId: 'valencia', from: 2010, to: 2014},
      {clubId: 'man-city', from: 2015, to: 2020},
      {clubId: 'benfica', from: 2020},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2022]}],
  },
];
