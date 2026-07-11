/**
 * Club reference data. `league` ids match the quiz topic ids so league
 * categories ("all PL players") fall out of the data with no extra mapping.
 * Footballers reference clubs by id only — keep this the single source of
 * truth for club name / country / league.
 */
import {derivedFromData} from './generation';
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
  {id: 'southampton', name: 'Southampton', country: 'England', league: 'premier-league'},
  {id: 'qpr', name: 'Queens Park Rangers', country: 'England', league: 'premier-league'},
  {id: 'fulham', name: 'Fulham', country: 'England', league: 'premier-league'},

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
  {id: 'bologna', name: 'Bologna', country: 'Italy', league: 'serie-a'},

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
  {id: 'paris-fc', name: 'Paris FC', country: 'France', league: 'ligue-1'},

  // Other (used by career history but not a primary quiz league)
  {id: 'barnsley', name: 'Barnsley', country: 'England', league: 'championship'},
  {id: 'inter-miami', name: 'Inter Miami', country: 'USA', league: 'mls'},
  {id: 'lafc', name: 'Los Angeles FC', country: 'USA', league: 'mls'},
  {id: 'la-galaxy', name: 'LA Galaxy', country: 'USA', league: 'mls'},
  {id: 'vancouver', name: 'Vancouver Whitecaps', country: 'Canada', league: 'mls'},
  {id: 'al-nassr', name: 'Al Nassr', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'al-hilal', name: 'Al Hilal', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'al-ittihad', name: 'Al-Ittihad', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'al-qadsiah', name: 'Al-Qadsiah', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'al-ahli', name: 'Al-Ahli', country: 'Saudi Arabia', league: 'saudi-pro-league'},
  {id: 'sporting', name: 'Sporting CP', country: 'Portugal', league: 'primeira-liga'},
  {id: 'benfica', name: 'Benfica', country: 'Portugal', league: 'primeira-liga'},
  {id: 'porto', name: 'FC Porto', country: 'Portugal', league: 'primeira-liga'},
  {id: 'ajax', name: 'Ajax', country: 'Netherlands', league: 'eredivisie'},
  {id: 'santos', name: 'Santos', country: 'Brazil', league: 'brasileirao'},
  {id: 'fluminense', name: 'Fluminense', country: 'Brazil', league: 'brasileirao'},
  {id: 'flamengo', name: 'Flamengo', country: 'Brazil', league: 'brasileirao'},
  {id: 'palmeiras', name: 'Palmeiras', country: 'Brazil', league: 'brasileirao'},
  {id: 'boca-juniors', name: 'Boca Juniors', country: 'Argentina', league: 'liga-argentina'},
  {id: 'river-plate', name: 'River Plate', country: 'Argentina', league: 'liga-argentina'},
  {id: 'rosario-central', name: 'Rosario Central', country: 'Argentina', league: 'liga-argentina'},
  {id: 'monterrey', name: 'Monterrey', country: 'Mexico', league: 'liga-mx'},
  {id: 'galatasaray', name: 'Galatasaray', country: 'Turkey', league: 'super-lig'},
  {id: 'besiktas', name: 'Beşiktaş', country: 'Turkey', league: 'super-lig'},
  {id: 'fenerbahce', name: 'Fenerbahçe', country: 'Turkey', league: 'super-lig'},
  {id: 'celtic', name: 'Celtic', country: 'Scotland', league: 'scottish-premiership'},

  // --- WC 2026 batch: CONCACAF / hosts / OFC ---
  {id: 'nottingham-forest', name: 'Nottingham Forest', country: 'England', league: 'premier-league'},
  {id: 'crystal-palace', name: 'Crystal Palace', country: 'England', league: 'premier-league'},
  {id: 'bournemouth', name: 'AFC Bournemouth', country: 'England', league: 'premier-league'},
  {id: 'burnley', name: 'Burnley', country: 'England', league: 'premier-league'},
  {id: 'brentford', name: 'Brentford', country: 'England', league: 'premier-league'},
  {id: 'werder-bremen', name: 'Werder Bremen', country: 'Germany', league: 'bundesliga'},
  {id: 'psv', name: 'PSV Eindhoven', country: 'Netherlands', league: 'eredivisie'},
  {id: 'feyenoord', name: 'Feyenoord', country: 'Netherlands', league: 'eredivisie'},
  {id: 'genoa', name: 'Genoa', country: 'Italy', league: 'serie-a'},
  {id: 'nice', name: 'OGC Nice', country: 'France', league: 'ligue-1'},
  {id: 'club-brugge', name: 'Club Brugge', country: 'Belgium', league: 'belgian-pro-league'},
  {id: 'club-america', name: 'Club América', country: 'Mexico', league: 'liga-mx'},
  {id: 'guadalajara', name: 'Guadalajara', country: 'Mexico', league: 'liga-mx'},
  {id: 'tigres', name: 'Tigres UANL', country: 'Mexico', league: 'liga-mx'},
  {id: 'cruz-azul', name: 'Cruz Azul', country: 'Mexico', league: 'liga-mx'},
  {id: 'pumas', name: 'Pumas UNAM', country: 'Mexico', league: 'liga-mx'},
  {id: 'pachuca', name: 'Pachuca', country: 'Mexico', league: 'liga-mx'},
  {id: 'toluca', name: 'Toluca', country: 'Mexico', league: 'liga-mx'},
  {id: 'real-mallorca', name: 'Real Mallorca', country: 'Spain', league: 'la-liga'},
  {id: 'brighton', name: 'Brighton & Hove Albion', country: 'England', league: 'premier-league'},
  {id: 'anderlecht', name: 'Anderlecht', country: 'Belgium', league: 'belgian-pro-league'},
  {id: 'twente', name: 'FC Twente', country: 'Netherlands', league: 'eredivisie'},
  {id: 'girona', name: 'Girona', country: 'Spain', league: 'la-liga'},

  // --- WC 2026 batch: AFC ---
  {id: 'eintracht-frankfurt', name: 'Eintracht Frankfurt', country: 'Germany', league: 'bundesliga'},
  {id: 'vfb-stuttgart', name: 'VfB Stuttgart', country: 'Germany', league: 'bundesliga'},
  {id: 'freiburg', name: 'SC Freiburg', country: 'Germany', league: 'bundesliga'},
  {id: 'parma', name: 'Parma', country: 'Italy', league: 'serie-a'},
  {id: 'genk', name: 'KRC Genk', country: 'Belgium', league: 'belgian-pro-league'},
  {id: 'lens', name: 'RC Lens', country: 'France', league: 'ligue-1'},
  {id: 'montpellier', name: 'Montpellier', country: 'France', league: 'ligue-1'},
  {id: 'al-sadd', name: 'Al Sadd', country: 'Qatar', league: 'qatar-stars-league'},
  {id: 'al-duhail', name: 'Al Duhail', country: 'Qatar', league: 'qatar-stars-league'},
  {id: 'reims', name: 'Stade de Reims', country: 'France', league: 'ligue-1'},

  // --- WC 2026 batch: CAF ---
  {id: 'athletic-bilbao', name: 'Athletic Bilbao', country: 'Spain', league: 'la-liga'},
  {id: 'torino', name: 'Torino', country: 'Italy', league: 'serie-a'},
  {id: 'nantes', name: 'FC Nantes', country: 'France', league: 'ligue-1'},
  {id: 'al-ahly', name: 'Al Ahly', country: 'Egypt', league: 'egyptian-premier-league'},
  {id: 'mamelodi-sundowns', name: 'Mamelodi Sundowns', country: 'South Africa', league: 'south-african-league'},
  {id: 'toulouse', name: 'Toulouse', country: 'France', league: 'ligue-1'},
  {id: 'metz', name: 'FC Metz', country: 'France', league: 'ligue-1'},
  {id: 'lorient', name: 'FC Lorient', country: 'France', league: 'ligue-1'},
  {id: 'empoli', name: 'Empoli', country: 'Italy', league: 'serie-a'},
  {id: 'udinese', name: 'Udinese', country: 'Italy', league: 'serie-a'},
  {id: 'trabzonspor', name: 'Trabzonspor', country: 'Turkey', league: 'super-lig'},
  {id: 'sunderland', name: 'Sunderland', country: 'England', league: 'premier-league'},
  {id: 'bristol-city', name: 'Bristol City', country: 'England', league: 'championship'},
  {id: 'union-sg', name: 'Union Saint-Gilloise', country: 'Belgium', league: 'belgian-pro-league'},
  {id: 'basel', name: 'FC Basel', country: 'Switzerland', league: 'swiss-super-league'},

  // --- WC 2026 batch: CONMEBOL ---
  {id: 'getafe', name: 'Getafe', country: 'Spain', league: 'la-liga'},
  {id: 'como', name: 'Como', country: 'Italy', league: 'serie-a'},
  {id: 'internacional', name: 'Internacional', country: 'Brazil', league: 'brasileirao'},
  {id: 'botafogo', name: 'Botafogo', country: 'Brazil', league: 'brasileirao'},
  {id: 'watford', name: 'Watford', country: 'England', league: 'championship'},
  {id: 'cagliari', name: 'Cagliari', country: 'Italy', league: 'serie-a'},
  {id: 'hertha-berlin', name: 'Hertha Berlin', country: 'Germany', league: 'bundesliga'},
  {id: 'west-brom', name: 'West Bromwich Albion', country: 'England', league: 'championship'},

  // --- WC 2026 batch: UEFA ---
  {id: 'hoffenheim', name: 'TSG Hoffenheim', country: 'Germany', league: 'bundesliga'},
  {id: 'union-berlin', name: 'Union Berlin', country: 'Germany', league: 'bundesliga'},
  {id: 'mainz', name: 'Mainz 05', country: 'Germany', league: 'bundesliga'},
  {id: 'az-alkmaar', name: 'AZ Alkmaar', country: 'Netherlands', league: 'eredivisie'},
  {id: 'lecce', name: 'Lecce', country: 'Italy', league: 'serie-a'},
  {id: 'sampdoria', name: 'Sampdoria', country: 'Italy', league: 'serie-a'},
  {id: 'hellas-verona', name: 'Hellas Verona', country: 'Italy', league: 'serie-a'},
  {id: 'sheffield-united', name: 'Sheffield United', country: 'England', league: 'championship'},
  {id: 'salzburg', name: 'Red Bull Salzburg', country: 'Austria', league: 'austrian-bundesliga'},
  {id: 'dinamo-zagreb', name: 'Dinamo Zagreb', country: 'Croatia', league: 'croatian-hnl'},
  {id: 'midtjylland', name: 'FC Midtjylland', country: 'Denmark', league: 'danish-superliga'},
  {id: 'copenhagen', name: 'FC Copenhagen', country: 'Denmark', league: 'danish-superliga'},
  {id: 'shakhtar', name: 'Shakhtar Donetsk', country: 'Ukraine', league: 'ukrainian-league'},
  {id: 'dynamo-kyiv', name: 'Dynamo Kyiv', country: 'Ukraine', league: 'ukrainian-league'},
  {id: 'ferencvaros', name: 'Ferencváros', country: 'Hungary', league: 'hungarian-league'},
  {id: 'olympiacos', name: 'Olympiacos', country: 'Greece', league: 'greek-super-league'},
  {id: 'augsburg', name: 'FC Augsburg', country: 'Germany', league: 'bundesliga'},
  {id: 'spezia', name: 'Spezia', country: 'Italy', league: 'serie-a'},
  {id: 'norwich', name: 'Norwich City', country: 'England', league: 'championship'},
  {id: 'al-shabab', name: 'Al-Shabab', country: 'Saudi Arabia', league: 'saudi-pro-league'},

  // --- Curation batch 2026-07: career-history clubs for legends/journeymen ---
  // (Bordeaux/Brescia deliberately absent: no crest in the logo mirror yet.)
  {id: 'gremio', name: 'Grêmio', country: 'Brazil', league: 'brasileirao'},
  {id: 'hamburg', name: 'Hamburger SV', country: 'Germany', league: 'bundesliga'},
  {id: 'blackburn', name: 'Blackburn Rovers', country: 'England', league: 'premier-league'},
  {id: 'celta-vigo', name: 'Celta Vigo', country: 'Spain', league: 'la-liga'},
  {id: 'corinthians', name: 'Corinthians', country: 'Brazil', league: 'brasileirao'},
  {id: 'stoke', name: 'Stoke City', country: 'England', league: 'premier-league'},
  {id: 'bolton', name: 'Bolton Wanderers', country: 'England', league: 'premier-league'},
  {id: 'kaiserslautern', name: '1. FC Kaiserslautern', country: 'Germany', league: 'bundesliga'},
  {id: 'saint-etienne', name: 'Saint-Étienne', country: 'France', league: 'ligue-1'},
  {id: 'elche', name: 'Elche', country: 'Spain', league: 'la-liga'},
  {id: 'cannes', name: 'AS Cannes', country: 'France', league: 'ligue-1'},
  {id: 'orlando-city', name: 'Orlando City', country: 'USA', league: 'mls'},
  {id: 'deportivo', name: 'Deportivo La Coruña', country: 'Spain', league: 'la-liga'},
  {id: 'koln', name: '1. FC Köln', country: 'Germany', league: 'bundesliga'},
  {id: 'brondby', name: 'Brøndby', country: 'Denmark', league: 'danish-superliga'},
  {id: 'aek-athens', name: 'AEK Athens', country: 'Greece', league: 'greek-super-league'},
];

const clubsById = derivedFromData(
  (): ReadonlyMap<string, Club> => new Map(CLUBS.map(club => [club.id, club])),
);

export function getClub(clubId: string): Club | undefined {
  return clubsById().get(clubId);
}
