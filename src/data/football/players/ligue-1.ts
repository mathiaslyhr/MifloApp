/**
 * Modern players most associated with Ligue 1. Membership is organisational
 * only — see leaguesOf; matching is derived from club spells.
 */
import type {Footballer} from '../types';

export const LIGUE_1: readonly Footballer[] = [
  {
    id: 'kylian-mbappe',
    name: 'Kylian Mbappé',
    nationality: ['France'],
    positions: ['FW'],
    shirtNumbers: [7, 9, 10],
    clubs: [
      {clubId: 'monaco', from: 2015, to: 2017},
      {clubId: 'psg', from: 2017, to: 2024},
      {clubId: 'real-madrid', from: 2024},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2018]}],
  },
  {
    id: 'ousmane-dembele',
    name: 'Ousmane Dembélé',
    nationality: ['France'],
    positions: ['FW'],
    shirtNumbers: [10],
    clubs: [
      {clubId: 'dortmund', from: 2016, to: 2017},
      {clubId: 'barcelona', from: 2017, to: 2023},
      {clubId: 'psg', from: 2023},
    ],
    honours: [
      {type: 'champions-league', count: 1, years: [2025]},
      {type: 'world-cup', count: 1, years: [2018]},
    ],
  },
  {
    id: 'achraf-hakimi',
    name: 'Achraf Hakimi',
    nationality: ['Morocco'],
    positions: ['DF'],
    shirtNumbers: [2],
    clubs: [
      {clubId: 'real-madrid', from: 2017, to: 2018},
      {clubId: 'dortmund', from: 2018, to: 2020, loan: true},
      {clubId: 'inter', from: 2020, to: 2021},
      {clubId: 'psg', from: 2021},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2025]}],
  },
  {
    id: 'marquinhos',
    name: 'Marquinhos',
    nationality: ['Brazil'],
    positions: ['DF'],
    shirtNumbers: [5],
    clubs: [
      {clubId: 'roma', from: 2012, to: 2013},
      {clubId: 'psg', from: 2013},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2025]}],
  },
  {
    id: 'vitinha',
    name: 'Vitinha',
    nationality: ['Portugal'],
    positions: ['MF'],
    shirtNumbers: [17],
    clubs: [
      {clubId: 'porto', from: 2020, to: 2022},
      {clubId: 'psg', from: 2022},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2025]}],
  },
  {
    id: 'edinson-cavani',
    name: 'Edinson Cavani',
    nationality: ['Uruguay'],
    positions: ['FW'],
    shirtNumbers: [9, 7],
    clubs: [
      {clubId: 'napoli', from: 2010, to: 2013},
      {clubId: 'psg', from: 2013, to: 2020},
      {clubId: 'man-utd', from: 2020, to: 2022},
    ],
    honours: [],
  },
  {
    id: 'pierre-emerick-aubameyang',
    name: 'Pierre-Emerick Aubameyang',
    nationality: ['Gabon'],
    positions: ['FW'],
    shirtNumbers: [14, 17],
    clubs: [
      {clubId: 'dortmund', from: 2013, to: 2018},
      {clubId: 'arsenal', from: 2018, to: 2022},
      {clubId: 'barcelona', from: 2022, to: 2023},
      {clubId: 'marseille', from: 2023, to: 2024},
    ],
    honours: [],
  },
];
