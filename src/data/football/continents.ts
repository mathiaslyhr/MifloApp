/**
 * Country → continent map for the geography axis (Offside's "continent"
 * criterion). Keyed by the country names as written in player `nationality`.
 *
 * IMPORTANT: every nationality that appears in footballers.ts MUST be listed
 * here. An unmapped country returns `undefined`, which would let a player who
 * actually belongs to a continent be picked as that continent's OUTLIER — a
 * wrong round. A test (`continents.test.ts`) enforces full coverage; when you
 * add a player with a new nationality, add it here too.
 *
 * Transcontinental nations follow their football confederation, matching fan
 * intuition: UEFA members (Armenia, Georgia, Russia, Turkey) → Europe;
 * Australia and New Zealand → Oceania (geographic, not their AFC/OFC membership).
 */
import type {Continent} from './types';

export const CONTINENTS: readonly Continent[] = [
  'Europe',
  'South America',
  'North America',
  'Africa',
  'Asia',
  'Oceania',
];

const COUNTRY_CONTINENT: Record<string, Continent> = {
  // Europe
  Armenia: 'Europe',
  Austria: 'Europe',
  Belarus: 'Europe',
  Belgium: 'Europe',
  'Bosnia and Herzegovina': 'Europe',
  Bulgaria: 'Europe',
  Croatia: 'Europe',
  'Czech Republic': 'Europe',
  Denmark: 'Europe',
  England: 'Europe',
  Finland: 'Europe',
  France: 'Europe',
  Georgia: 'Europe',
  Germany: 'Europe',
  Greece: 'Europe',
  Hungary: 'Europe',
  Iceland: 'Europe',
  Ireland: 'Europe',
  Italy: 'Europe',
  Kosovo: 'Europe',
  Montenegro: 'Europe',
  Netherlands: 'Europe',
  'North Macedonia': 'Europe',
  'Northern Ireland': 'Europe',
  Norway: 'Europe',
  Poland: 'Europe',
  Portugal: 'Europe',
  Romania: 'Europe',
  Russia: 'Europe',
  Scotland: 'Europe',
  Serbia: 'Europe',
  Slovakia: 'Europe',
  Slovenia: 'Europe',
  Spain: 'Europe',
  Sweden: 'Europe',
  Switzerland: 'Europe',
  Turkey: 'Europe',
  Ukraine: 'Europe',
  Wales: 'Europe',
  // South America
  Argentina: 'South America',
  Brazil: 'South America',
  Chile: 'South America',
  Colombia: 'South America',
  Ecuador: 'South America',
  Paraguay: 'South America',
  Peru: 'South America',
  Uruguay: 'South America',
  Venezuela: 'South America',
  // North America (incl. Central America & Caribbean)
  Canada: 'North America',
  'Costa Rica': 'North America',
  Curacao: 'North America',
  Honduras: 'North America',
  Jamaica: 'North America',
  Mexico: 'North America',
  Panama: 'North America',
  'Trinidad and Tobago': 'North America',
  USA: 'North America',
  // Africa
  Algeria: 'Africa',
  Cameroon: 'Africa',
  'DR Congo': 'Africa',
  Egypt: 'Africa',
  Gabon: 'Africa',
  Gambia: 'Africa',
  Ghana: 'Africa',
  Guinea: 'Africa',
  'Ivory Coast': 'Africa',
  Liberia: 'Africa',
  Mali: 'Africa',
  Morocco: 'Africa',
  Mozambique: 'Africa',
  Nigeria: 'Africa',
  Senegal: 'Africa',
  'South Africa': 'Africa',
  Togo: 'Africa',
  Tunisia: 'Africa',
  Uganda: 'Africa',
  Zambia: 'Africa',
  Zimbabwe: 'Africa',
  // Asia
  Iran: 'Asia',
  Japan: 'Asia',
  Jordan: 'Asia',
  Qatar: 'Asia',
  'Saudi Arabia': 'Asia',
  'South Korea': 'Asia',
  Uzbekistan: 'Asia',
  // Oceania
  Australia: 'Oceania',
  'New Zealand': 'Oceania',
};

/** The continent a country belongs to, or undefined if unmapped. */
export function continentOf(country: string): Continent | undefined {
  return COUNTRY_CONTINENT[country];
}
