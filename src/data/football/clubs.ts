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
  {id: 'aston-villa', name: 'Aston Villa', country: 'England', league: 'premier-league'},
  {id: 'everton', name: 'Everton', country: 'England', league: 'premier-league'},
  {id: 'newcastle', name: 'Newcastle United', country: 'England', league: 'premier-league'},
  {id: 'west-ham', name: 'West Ham United', country: 'England', league: 'premier-league'},
  {id: 'leicester', name: 'Leicester City', country: 'England', league: 'premier-league'},
  {id: 'leeds', name: 'Leeds United', country: 'England', league: 'premier-league'},
  {id: 'wolves', name: 'Wolverhampton Wanderers', country: 'England', league: 'premier-league'},

  // La Liga
  {id: 'real-madrid', name: 'Real Madrid', country: 'Spain', league: 'la-liga'},
  {id: 'barcelona', name: 'Barcelona', country: 'Spain', league: 'la-liga'},
  {id: 'atletico-madrid', name: 'Atlético Madrid', country: 'Spain', league: 'la-liga'},
  {id: 'sevilla', name: 'Sevilla', country: 'Spain', league: 'la-liga'},
  {id: 'valencia', name: 'Valencia', country: 'Spain', league: 'la-liga'},
  {id: 'villarreal', name: 'Villarreal', country: 'Spain', league: 'la-liga'},
  {id: 'real-sociedad', name: 'Real Sociedad', country: 'Spain', league: 'la-liga'},
  {id: 'real-betis', name: 'Real Betis', country: 'Spain', league: 'la-liga'},

  // Serie A
  {id: 'juventus', name: 'Juventus', country: 'Italy', league: 'serie-a'},
  {id: 'inter', name: 'Inter', country: 'Italy', league: 'serie-a'},
  {id: 'ac-milan', name: 'AC Milan', country: 'Italy', league: 'serie-a'},
  {id: 'napoli', name: 'Napoli', country: 'Italy', league: 'serie-a'},
  {id: 'roma', name: 'AS Roma', country: 'Italy', league: 'serie-a'},
  {id: 'lazio', name: 'Lazio', country: 'Italy', league: 'serie-a'},
  {id: 'fiorentina', name: 'Fiorentina', country: 'Italy', league: 'serie-a'},
  {id: 'atalanta', name: 'Atalanta', country: 'Italy', league: 'serie-a'},

  // Bundesliga
  {id: 'bayern', name: 'Bayern München', country: 'Germany', league: 'bundesliga'},
  {id: 'dortmund', name: 'Borussia Dortmund', country: 'Germany', league: 'bundesliga'},
  {id: 'leverkusen', name: 'Bayer Leverkusen', country: 'Germany', league: 'bundesliga'},
  {id: 'schalke', name: 'Schalke 04', country: 'Germany', league: 'bundesliga'},
  {id: 'rb-leipzig', name: 'RB Leipzig', country: 'Germany', league: 'bundesliga'},
  {id: 'wolfsburg', name: 'VfL Wolfsburg', country: 'Germany', league: 'bundesliga'},
  {id: 'monchengladbach', name: "Borussia M'gladbach", country: 'Germany', league: 'bundesliga'},

  // Ligue 1
  {id: 'psg', name: 'Paris Saint-Germain', country: 'France', league: 'ligue-1'},
  {id: 'monaco', name: 'AS Monaco', country: 'France', league: 'ligue-1'},
  {id: 'marseille', name: 'Olympique de Marseille', country: 'France', league: 'ligue-1'},
  {id: 'lyon', name: 'Olympique Lyonnais', country: 'France', league: 'ligue-1'},
  {id: 'lille', name: 'Lille', country: 'France', league: 'ligue-1'},
  {id: 'rennes', name: 'Stade Rennais', country: 'France', league: 'ligue-1'},

  // Other (used by career history but not a primary quiz league)
  {id: 'inter-miami', name: 'Inter Miami', country: 'USA', league: 'mls'},
  {id: 'al-nassr', name: 'Al Nassr', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'al-hilal', name: 'Al Hilal', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'al-qadsiah', name: 'Al-Qadsiah', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'sporting', name: 'Sporting CP', country: 'Portugal', league: 'primeira-liga'},
  {id: 'benfica', name: 'Benfica', country: 'Portugal', league: 'primeira-liga'},
  {id: 'porto', name: 'FC Porto', country: 'Portugal', league: 'primeira-liga'},
  {id: 'ajax', name: 'Ajax', country: 'Netherlands', league: 'eredivisie'},
  {id: 'santos', name: 'Santos', country: 'Brazil', league: 'brasileirao'},
  {id: 'flamengo', name: 'Flamengo', country: 'Brazil', league: 'brasileirao'},
  {id: 'palmeiras', name: 'Palmeiras', country: 'Brazil', league: 'brasileirao'},
  {id: 'boca-juniors', name: 'Boca Juniors', country: 'Argentina', league: 'liga-argentina'},
  {id: 'river-plate', name: 'River Plate', country: 'Argentina', league: 'liga-argentina'},
  {id: 'galatasaray', name: 'Galatasaray', country: 'Turkey', league: 'super-lig'},
  {id: 'celtic', name: 'Celtic', country: 'Scotland', league: 'scottish-premiership'},
];

const CLUBS_BY_ID: ReadonlyMap<string, Club> = new Map(
  CLUBS.map(club => [club.id, club]),
);

export function getClub(clubId: string): Club | undefined {
  return CLUBS_BY_ID.get(clubId);
}
