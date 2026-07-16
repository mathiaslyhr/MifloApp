/**
 * Iconic non-final XIs — league deciders, famous thrashings, classics.
 * Curation rules in CURATION.md.
 */
import type {FamousLineup} from '../famousLineups';

export const CLASSICS: readonly FamousLineup[] = [
  {
    id: 'leicester-2016-league-classic',
    team: 'Leicester City',
    competition: 'Premier League',
    year: 2016,
    formation: '4-4-2',
    // Leicester's royal-blue home clashes with City's sky blue, so the 2015-16
    // black away kit. Lifted off true black on purpose: the board sits on
    // #121212 / #1A1A1A and a real black shirt renders an invisible circle.
    kit: {body: '#2A2A2A', number: '#F4F4F6'},
    match: {
      competitionKey: 'leagueMatch',
      opponent: 'Manchester City',
      goalsFor: 3,
      goalsAgainst: 1,
    },
    players: [
      {name: 'Kasper Schmeichel', position: 'GK', shirt: 1},
      {name: 'Danny Simpson', position: 'DF', shirt: 17, yellowCard: true},
      {name: 'Wes Morgan', position: 'DF', shirt: 5, captain: true, yellowCard: true},
      {name: 'Robert Huth', position: 'DF', shirt: 6, goals: 2},
      {name: 'Christian Fuchs', position: 'DF', shirt: 28, assists: 1},
      {name: 'Riyad Mahrez', position: 'MF', shirt: 26, goals: 1, assists: 1, subbedOff: true},
      {name: 'Danny Drinkwater', position: 'MF', shirt: 4},
      {name: "N'Golo Kanté", position: 'MF', shirt: 14, aliases: ['Ngolo Kante'], assists: 1},
      {name: 'Marc Albrighton', position: 'MF', shirt: 11, subbedOff: true},
      {name: 'Jamie Vardy', position: 'FW', shirt: 9},
      {name: 'Shinji Okazaki', position: 'FW', shirt: 20, subbedOff: true},
    ],
  },
  {
    id: 'manchester-city-2016-league-classic',
    team: 'Manchester City',
    competition: 'Premier League',
    year: 2016,
    formation: '4-2-3-1',
    kit: {body: '#6CABDD', number: '#F4F4F6'},
    match: {
      competitionKey: 'leagueMatch',
      opponent: 'Leicester City',
      goalsFor: 1,
      goalsAgainst: 3,
    },
    players: [
      {name: 'Joe Hart', position: 'GK', shirt: 1},
      {name: 'Pablo Zabaleta', position: 'DF', shirt: 5, yellowCard: true},
      {name: 'Nicolás Otamendi', position: 'DF', shirt: 30},
      {name: 'Martín Demichelis', position: 'DF', shirt: 26},
      {name: 'Aleksandar Kolarov', position: 'DF', shirt: 11},
      {name: 'Fernandinho', position: 'MF', shirt: 25},
      {name: 'Yaya Touré', position: 'MF', shirt: 42, captain: true, subbedOff: true},
      {name: 'Raheem Sterling', position: 'FW', shirt: 7},
      {name: 'David Silva', position: 'MF', shirt: 21, subbedOff: true},
      {name: 'Fabian Delph', position: 'MF', shirt: 18, subbedOff: true},
      // Agüero's 87th-minute consolation was assisted by Celina, a substitute,
      // so no assist is recorded — only the starting XI exists here.
      {name: 'Sergio Agüero', position: 'FW', shirt: 10, goals: 1},
    ],
  },
];
