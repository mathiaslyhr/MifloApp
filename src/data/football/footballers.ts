/**
 * Curated footballer database (hand-maintained seed set).
 *
 * Reviewed for accuracy: club histories list the major senior clubs each player
 * actually played for, and honours are limited to ones that are easy to state
 * exactly — Champions League, World Cup, Ballon d'Or, European Championship.
 * (Deliberately no league-title / golden-boot counts, which are obscure and
 * error-prone to maintain by hand.) Up to date as of mid-2026.
 *
 * Clubs are referenced by id only; see clubs.ts for the club source of truth.
 * Years are approximate transfer years and only used as supporting data.
 * Expand this list over time — the schema (types.ts) is the stable part.
 */
import type {Footballer} from './types';

export const FOOTBALLERS: readonly Footballer[] = [
  {
    id: 'lionel-messi',
    name: 'Lionel Messi',
    nationality: ['Argentina'],
    positions: ['FW'],
    shirtNumbers: [10, 30],
    clubs: [
      {clubId: 'barcelona', from: 2004, to: 2021},
      {clubId: 'psg', from: 2021, to: 2023},
      {clubId: 'inter-miami', from: 2023},
    ],
    honours: [
      {type: 'champions-league', count: 4},
      {type: 'world-cup', count: 1, years: [2022]},
      {type: 'ballon-dor', count: 8, years: [2009, 2010, 2011, 2012, 2015, 2019, 2021, 2023]},
    ],
    tags: ['legends'],
  },
  {
    id: 'cristiano-ronaldo',
    name: 'Cristiano Ronaldo',
    nationality: ['Portugal'],
    positions: ['FW'],
    shirtNumbers: [7],
    clubs: [
      {clubId: 'sporting', from: 2002, to: 2003},
      {clubId: 'man-utd', from: 2003, to: 2009},
      {clubId: 'real-madrid', from: 2009, to: 2018},
      {clubId: 'juventus', from: 2018, to: 2021},
      {clubId: 'man-utd', from: 2021, to: 2022},
      {clubId: 'al-nassr', from: 2023},
    ],
    honours: [
      {type: 'champions-league', count: 5},
      {type: 'european-championship', count: 1, years: [2016]},
      {type: 'ballon-dor', count: 5},
    ],
    tags: ['legends'],
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
    id: 'toni-kroos',
    name: 'Toni Kroos',
    nationality: ['Germany'],
    positions: ['MF'],
    shirtNumbers: [8],
    clubs: [
      {clubId: 'bayern', from: 2007, to: 2014},
      {clubId: 'real-madrid', from: 2014, to: 2024},
    ],
    honours: [
      {type: 'champions-league', count: 6},
      {type: 'world-cup', count: 1, years: [2014]},
    ],
    tags: ['legends'],
  },
  {
    id: 'luka-modric',
    name: 'Luka Modrić',
    nationality: ['Croatia'],
    positions: ['MF'],
    shirtNumbers: [10],
    clubs: [
      {clubId: 'tottenham', from: 2008, to: 2012},
      {clubId: 'real-madrid', from: 2012, to: 2025},
      {clubId: 'ac-milan', from: 2025},
    ],
    honours: [
      {type: 'champions-league', count: 6},
      {type: 'ballon-dor', count: 1, years: [2018]},
    ],
    tags: ['legends'],
  },
  {
    id: 'zlatan-ibrahimovic',
    name: 'Zlatan Ibrahimović',
    nationality: ['Sweden'],
    positions: ['FW'],
    shirtNumbers: [9, 10, 11],
    clubs: [
      {clubId: 'ajax', from: 2001, to: 2004},
      {clubId: 'juventus', from: 2004, to: 2006},
      {clubId: 'inter', from: 2006, to: 2009},
      {clubId: 'barcelona', from: 2009, to: 2010},
      {clubId: 'ac-milan', from: 2010, to: 2012},
      {clubId: 'psg', from: 2012, to: 2016},
      {clubId: 'man-utd', from: 2016, to: 2018},
    ],
    honours: [],
    tags: ['legends'],
  },
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
    id: 'ronaldinho',
    name: 'Ronaldinho',
    nationality: ['Brazil'],
    positions: ['FW', 'MF'],
    shirtNumbers: [10, 80],
    clubs: [
      {clubId: 'psg', from: 2001, to: 2003},
      {clubId: 'barcelona', from: 2003, to: 2008},
      {clubId: 'ac-milan', from: 2008, to: 2011},
    ],
    honours: [
      {type: 'world-cup', count: 1, years: [2002]},
      {type: 'ballon-dor', count: 1, years: [2005]},
    ],
    tags: ['legends'],
  },
  {
    id: 'kaka',
    name: 'Kaká',
    nationality: ['Brazil'],
    positions: ['MF'],
    shirtNumbers: [22, 8],
    clubs: [
      {clubId: 'ac-milan', from: 2003, to: 2009},
      {clubId: 'real-madrid', from: 2009, to: 2013},
      {clubId: 'ac-milan', from: 2013, to: 2014},
    ],
    honours: [
      {type: 'champions-league', count: 1, years: [2007]},
      {type: 'world-cup', count: 1, years: [2002]},
      {type: 'ballon-dor', count: 1, years: [2007]},
    ],
    tags: ['legends'],
  },
  {
    id: 'antoine-griezmann',
    name: 'Antoine Griezmann',
    nationality: ['France'],
    positions: ['FW'],
    shirtNumbers: [7],
    clubs: [
      {clubId: 'atletico-madrid', from: 2014, to: 2019},
      {clubId: 'barcelona', from: 2019, to: 2021},
      {clubId: 'atletico-madrid', from: 2021},
    ],
    honours: [{type: 'world-cup', count: 1, years: [2018]}],
  },
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
    id: 'virgil-van-dijk',
    name: 'Virgil van Dijk',
    nationality: ['Netherlands'],
    positions: ['DF'],
    shirtNumbers: [4],
    clubs: [{clubId: 'liverpool', from: 2018}],
    honours: [{type: 'champions-league', count: 1, years: [2019]}],
  },
  {
    id: 'pele',
    name: 'Pelé',
    nationality: ['Brazil'],
    positions: ['FW'],
    shirtNumbers: [10],
    clubs: [{clubId: 'santos', from: 1956, to: 1974}],
    honours: [{type: 'world-cup', count: 3, years: [1958, 1962, 1970]}],
    tags: ['legends'],
  },
];
