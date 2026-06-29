/**
 * Modern players most associated with the Premier League. Module membership is
 * organisational only — queries derive a player's leagues from their club
 * spells (see leaguesOf), so a player surfaces in every category their career
 * actually matches regardless of which file they live in.
 */
import type {Footballer} from '../types';

export const PREMIER_LEAGUE: readonly Footballer[] = [
  {
    id: 'mohamed-salah',
    name: 'Mohamed Salah',
    nationality: ['Egypt'],
    positions: ['FW'],
    shirtNumbers: [11],
    clubs: [
      {clubId: 'chelsea', from: 2014, to: 2016},
      {clubId: 'roma', from: 2016, to: 2017},
      {clubId: 'liverpool', from: 2017},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2019]}],
  },
  {
    id: 'virgil-van-dijk',
    name: 'Virgil van Dijk',
    nationality: ['Netherlands'],
    positions: ['DF'],
    shirtNumbers: [4],
    clubs: [{clubId: 'liverpool', from: 2018}],
    honours: [{type: 'champions-league', count: 1, years: [2019]}],
  },
  {
    id: 'harry-kane',
    name: 'Harry Kane',
    nationality: ['England'],
    positions: ['FW'],
    shirtNumbers: [9, 10],
    clubs: [
      {clubId: 'tottenham', from: 2011, to: 2023},
      {clubId: 'bayern', from: 2023},
    ],
    honours: [],
  },
  {
    id: 'erling-haaland',
    name: 'Erling Haaland',
    nationality: ['Norway'],
    positions: ['FW'],
    shirtNumbers: [9],
    clubs: [
      {clubId: 'dortmund', from: 2020, to: 2022},
      {clubId: 'man-city', from: 2022},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2023]}],
  },
  {
    id: 'kevin-de-bruyne',
    name: 'Kevin De Bruyne',
    nationality: ['Belgium'],
    positions: ['MF'],
    shirtNumbers: [17],
    clubs: [
      {clubId: 'chelsea', from: 2012, to: 2014},
      {clubId: 'man-city', from: 2015, to: 2025},
      {clubId: 'napoli', from: 2025},
    ],
    honours: [{type: 'champions-league', count: 1, years: [2023]}],
  },
  {
    id: 'rodri',
    name: 'Rodri',
    nationality: ['Spain'],
    positions: ['MF'],
    shirtNumbers: [16],
    clubs: [
      {clubId: 'atletico-madrid', from: 2018, to: 2019},
      {clubId: 'man-city', from: 2019},
    ],
    honours: [
      {type: 'champions-league', count: 1, years: [2023]},
      {type: 'european-championship', count: 1, years: [2024]},
      {type: 'ballon-dor', count: 1, years: [2024]},
    ],
  },
  {
    id: 'bukayo-saka',
    name: 'Bukayo Saka',
    nationality: ['England'],
    positions: ['FW', 'MF'],
    shirtNumbers: [7],
    clubs: [{clubId: 'arsenal', from: 2018}],
    honours: [],
  },
  {
    id: 'martin-odegaard',
    name: 'Martin Ødegaard',
    nationality: ['Norway'],
    positions: ['MF'],
    shirtNumbers: [8],
    clubs: [
      {clubId: 'real-madrid', from: 2015, to: 2021},
      {clubId: 'real-sociedad', from: 2021, to: 2021, loan: true},
      {clubId: 'arsenal', from: 2021},
    ],
    honours: [],
  },
  {
    id: 'bruno-fernandes',
    name: 'Bruno Fernandes',
    nationality: ['Portugal'],
    positions: ['MF'],
    shirtNumbers: [8],
    clubs: [
      {clubId: 'sporting', from: 2017, to: 2020},
      {clubId: 'man-utd', from: 2020},
    ],
    honours: [],
  },
  {
    id: 'heung-min-son',
    name: 'Heung-min Son',
    nationality: ['South Korea'],
    positions: ['FW'],
    shirtNumbers: [7],
    clubs: [
      {clubId: 'leverkusen', from: 2013, to: 2015},
      {clubId: 'tottenham', from: 2015, to: 2025},
    ],
    honours: [],
  },
];
