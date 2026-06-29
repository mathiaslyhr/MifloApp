/**
 * Modern players most associated with La Liga. Membership is organisational
 * only — see leaguesOf; category matching is derived from club spells.
 */
import type {Footballer} from '../types';

export const LA_LIGA: readonly Footballer[] = [
  {
    id: 'antoine-griezmann',
    name: 'Antoine Griezmann',
    nationality: ['France'],
    positions: ['FW'],
    shirtNumbers: [7],
    clubs: [
      {clubId: 'real-sociedad', from: 2009, to: 2014},
      {clubId: 'atletico-madrid', from: 2014, to: 2019},
      {clubId: 'barcelona', from: 2019, to: 2021},
      {clubId: 'atletico-madrid', from: 2021},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2018]}],
  },
  {
    id: 'vinicius-junior',
    name: 'Vinícius Júnior',
    nationality: ['Brazil'],
    positions: ['FW'],
    shirtNumbers: [7, 20],
    clubs: [{clubId: 'real-madrid', from: 2018}],
    honours: [{type: 'champions-league', count: 2, years: [2022, 2024]}],
  },
  {
    id: 'robert-lewandowski',
    name: 'Robert Lewandowski',
    nationality: ['Poland'],
    positions: ['FW'],
    shirtNumbers: [9],
    clubs: [
      {clubId: 'dortmund', from: 2010, to: 2014},
      {clubId: 'bayern', from: 2014, to: 2022},
      {clubId: 'barcelona', from: 2022},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2020]}],
  },
  {
    id: 'jude-bellingham',
    name: 'Jude Bellingham',
    nationality: ['England'],
    positions: ['MF'],
    shirtNumbers: [5],
    clubs: [
      {clubId: 'dortmund', from: 2020, to: 2023},
      {clubId: 'real-madrid', from: 2023},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2024]}],
  },
  {
    id: 'federico-valverde',
    name: 'Federico Valverde',
    nationality: ['Uruguay'],
    positions: ['MF'],
    shirtNumbers: [8, 15],
    clubs: [{clubId: 'real-madrid', from: 2016}],
    honours: [{type: 'champions-league', count: 2, years: [2022, 2024]}],
  },
];
