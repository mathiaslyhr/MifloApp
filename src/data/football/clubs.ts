/**
 * Club reference data. `league` ids match the quiz topic ids so league
 * categories ("all PL players") fall out of the data with no extra mapping.
 * Footballers reference clubs by id only — keep this the single source of
 * truth for club name / country / league.
 */
import type {Club} from './types';

export const CLUBS: readonly Club[] = [
  // Premier League
  {id: 'man-city', name: 'Manchester City', country: 'England', league: 'premier-league'},
  {id: 'man-utd', name: 'Manchester United', country: 'England', league: 'premier-league'},
  {id: 'arsenal', name: 'Arsenal', country: 'England', league: 'premier-league'},
  {id: 'chelsea', name: 'Chelsea', country: 'England', league: 'premier-league'},
  {id: 'liverpool', name: 'Liverpool', country: 'England', league: 'premier-league'},
  {id: 'tottenham', name: 'Tottenham Hotspur', country: 'England', league: 'premier-league'},

  // La Liga
  {id: 'real-madrid', name: 'Real Madrid', country: 'Spain', league: 'la-liga'},
  {id: 'barcelona', name: 'Barcelona', country: 'Spain', league: 'la-liga'},
  {id: 'atletico-madrid', name: 'Atlético Madrid', country: 'Spain', league: 'la-liga'},

  // Serie A
  {id: 'juventus', name: 'Juventus', country: 'Italy', league: 'serie-a'},
  {id: 'inter', name: 'Inter', country: 'Italy', league: 'serie-a'},
  {id: 'ac-milan', name: 'AC Milan', country: 'Italy', league: 'serie-a'},
  {id: 'napoli', name: 'Napoli', country: 'Italy', league: 'serie-a'},

  // Bundesliga
  {id: 'bayern', name: 'Bayern München', country: 'Germany', league: 'bundesliga'},
  {id: 'dortmund', name: 'Borussia Dortmund', country: 'Germany', league: 'bundesliga'},

  // Ligue 1
  {id: 'psg', name: 'Paris Saint-Germain', country: 'France', league: 'ligue-1'},
  {id: 'monaco', name: 'AS Monaco', country: 'France', league: 'ligue-1'},

  // Other (used by career history but not a primary quiz league)
  {id: 'inter-miami', name: 'Inter Miami', country: 'USA', league: 'mls'},
  {id: 'al-nassr', name: 'Al Nassr', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'al-hilal', name: 'Al Hilal', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'sporting', name: 'Sporting CP', country: 'Portugal', league: 'primeira-liga'},
  {id: 'ajax', name: 'Ajax', country: 'Netherlands', league: 'eredivisie'},
  {id: 'santos', name: 'Santos', country: 'Brazil', league: 'brasileirao'},
  {id: 'aston-villa', name: 'Aston Villa', country: 'England', league: 'premier-league'},
  {id: 'everton', name: 'Everton', country: 'England', league: 'premier-league'},
  {id: 'leverkusen', name: 'Bayer Leverkusen', country: 'Germany', league: 'bundesliga'},
  {id: 'roma', name: 'AS Roma', country: 'Italy', league: 'serie-a'},
];

const CLUBS_BY_ID: ReadonlyMap<string, Club> = new Map(
  CLUBS.map(club => [club.id, club]),
);

export function getClub(clubId: string): Club | undefined {
  return CLUBS_BY_ID.get(clubId);
}
