/**
 * Curated manager database — same conventions as footballers.ts: ONE
 * hand-maintained file, sorted alphabetically by `id` ("Surname, First";
 * single-name managers use that name). Club ids reference clubs.ts; national
 * teams use the country name as written in player nationalities.
 *
 * Not used by any game yet — groundwork for a "Managed by X" hattrick axis
 * (match = player's spell at a club overlaps the manager's spell there).
 * Portrait art will live in src/games/hattrick/assets (managers sheet).
 */
import type {Manager} from './types';

export const MANAGERS: readonly Manager[] = [
  {
    id: 'Ancelotti, Carlo',
    name: 'Carlo Ancelotti',
    nationality: ['Italy'],
    spells: [
      {clubId: 'juventus', from: 1999, to: 2001},
      {clubId: 'ac-milan', from: 2001, to: 2009},
      {clubId: 'chelsea', from: 2009, to: 2011},
      {clubId: 'psg', from: 2011, to: 2013},
      {clubId: 'real-madrid', from: 2013, to: 2015},
      {clubId: 'bayern', from: 2016, to: 2017},
      {clubId: 'napoli', from: 2018, to: 2019},
      {clubId: 'everton', from: 2019, to: 2021},
      {clubId: 'real-madrid', from: 2021, to: 2025},
      {country: 'Brazil', from: 2025},
    ],
  },
  {
    id: 'Benítez, Rafael',
    name: 'Rafael Benítez',
    nationality: ['Spain'],
    spells: [
      {clubId: 'valencia', from: 2001, to: 2004},
      {clubId: 'liverpool', from: 2004, to: 2010},
      {clubId: 'inter', from: 2010, to: 2010},
      {clubId: 'chelsea', from: 2012, to: 2013},
      {clubId: 'napoli', from: 2013, to: 2015},
      {clubId: 'real-madrid', from: 2015, to: 2016},
      {clubId: 'newcastle', from: 2016, to: 2019},
      {clubId: 'everton', from: 2021, to: 2022},
    ],
  },
  {
    id: 'Capello, Fabio',
    name: 'Fabio Capello',
    nationality: ['Italy'],
    spells: [
      {clubId: 'ac-milan', from: 1991, to: 1996},
      {clubId: 'real-madrid', from: 1996, to: 1997},
      {clubId: 'ac-milan', from: 1997, to: 1998},
      {clubId: 'roma', from: 1999, to: 2004},
      {clubId: 'juventus', from: 2004, to: 2006},
      {clubId: 'real-madrid', from: 2006, to: 2007},
      {country: 'England', from: 2008, to: 2012},
    ],
  },
  {
    id: 'Conte, Antonio',
    name: 'Antonio Conte',
    nationality: ['Italy'],
    spells: [
      {clubId: 'juventus', from: 2011, to: 2014},
      {country: 'Italy', from: 2014, to: 2016},
      {clubId: 'chelsea', from: 2016, to: 2018},
      {clubId: 'inter', from: 2019, to: 2021},
      {clubId: 'tottenham', from: 2021, to: 2023},
      {clubId: 'napoli', from: 2024},
    ],
  },
  {
    id: 'Del Bosque, Vicente',
    name: 'Vicente del Bosque',
    nationality: ['Spain'],
    spells: [
      {clubId: 'real-madrid', from: 1999, to: 2003},
      {country: 'Spain', from: 2008, to: 2016},
    ],
  },
  {
    id: 'Ferguson, Alex',
    name: 'Sir Alex Ferguson',
    nationality: ['Scotland'],
    spells: [{clubId: 'man-utd', from: 1986, to: 2013}],
  },
  {
    id: 'Guardiola, Pep',
    name: 'Pep Guardiola',
    nationality: ['Spain'],
    spells: [
      {clubId: 'barcelona', from: 2008, to: 2012},
      {clubId: 'bayern', from: 2013, to: 2016},
      {clubId: 'man-city', from: 2016},
    ],
  },
  {
    id: 'Klopp, Jürgen',
    name: 'Jürgen Klopp',
    nationality: ['Germany'],
    spells: [
      {clubId: 'mainz', from: 2001, to: 2008},
      {clubId: 'dortmund', from: 2008, to: 2015},
      {clubId: 'liverpool', from: 2015, to: 2024},
    ],
  },
  {
    id: 'Löw, Joachim',
    name: 'Joachim Löw',
    nationality: ['Germany'],
    spells: [{country: 'Germany', from: 2006, to: 2021}],
  },
  {
    id: 'Luis Enrique',
    name: 'Luis Enrique',
    nationality: ['Spain'],
    spells: [
      {clubId: 'roma', from: 2011, to: 2012},
      {clubId: 'barcelona', from: 2014, to: 2017},
      {country: 'Spain', from: 2018, to: 2022},
      {clubId: 'psg', from: 2023},
    ],
  },
  {
    id: 'Mourinho, José',
    name: 'José Mourinho',
    nationality: ['Portugal'],
    spells: [
      {clubId: 'porto', from: 2002, to: 2004},
      {clubId: 'chelsea', from: 2004, to: 2007},
      {clubId: 'inter', from: 2008, to: 2010},
      {clubId: 'real-madrid', from: 2010, to: 2013},
      {clubId: 'chelsea', from: 2013, to: 2015},
      {clubId: 'man-utd', from: 2016, to: 2018},
      {clubId: 'tottenham', from: 2019, to: 2021},
      {clubId: 'roma', from: 2021, to: 2024},
      {clubId: 'fenerbahce', from: 2024, to: 2025},
      {clubId: 'benfica', from: 2025},
    ],
  },
  {
    id: 'Simeone, Diego',
    name: 'Diego Simeone',
    nationality: ['Argentina'],
    spells: [{clubId: 'atletico-madrid', from: 2011}],
  },
  {
    id: 'Tuchel, Thomas',
    name: 'Thomas Tuchel',
    nationality: ['Germany'],
    spells: [
      {clubId: 'mainz', from: 2009, to: 2014},
      {clubId: 'dortmund', from: 2015, to: 2017},
      {clubId: 'psg', from: 2018, to: 2020},
      {clubId: 'chelsea', from: 2021, to: 2022},
      {clubId: 'bayern', from: 2023, to: 2024},
      {country: 'England', from: 2025},
    ],
  },
  {
    id: 'Van Gaal, Louis',
    name: 'Louis van Gaal',
    nationality: ['Netherlands'],
    spells: [
      {clubId: 'ajax', from: 1991, to: 1997},
      {clubId: 'barcelona', from: 1997, to: 2000},
      {country: 'Netherlands', from: 2000, to: 2002},
      {clubId: 'barcelona', from: 2002, to: 2003},
      {clubId: 'bayern', from: 2009, to: 2011},
      {country: 'Netherlands', from: 2012, to: 2014},
      {clubId: 'man-utd', from: 2014, to: 2016},
      {country: 'Netherlands', from: 2021, to: 2022},
    ],
  },
  {
    id: 'Wenger, Arsène',
    name: 'Arsène Wenger',
    nationality: ['France'],
    spells: [
      {clubId: 'monaco', from: 1987, to: 1994},
      {clubId: 'arsenal', from: 1996, to: 2018},
    ],
  },
  {
    id: 'Zidane, Zinédine',
    name: 'Zinédine Zidane',
    nationality: ['France'],
    spells: [
      {clubId: 'real-madrid', from: 2016, to: 2018},
      {clubId: 'real-madrid', from: 2019, to: 2021},
    ],
  },
];
