/**
 * Shared dataset of well-known world cities — a neutral, game-agnostic pool any
 * feature can draw on (place type-aheads, geography quizzes, host-city
 * pickers …). It lives here rather than inside a game so the next consumer
 * imports it from `data/geography`, not from another game's folder. Pure data,
 * no imports: the caller adapts it to whatever shape it needs.
 *
 * First consumer: Top Bins (`games/tenball/suggestions.ts`) unions this into
 * the `other` type-ahead so the CL-final-cities answers hide in a crowd instead
 * of being the only suggestions. Note that as bundled code it is NOT
 * over-the-air — growing the list reaches users through an App Store build.
 *
 * Invariants (a test in `__tests__/cities.test.ts` pins them):
 * - Every `country` MUST be a key of FLAG_IMAGES (flags.generated.ts) so any
 *   consumer can render a flag; images never ship OTA, so an unbundled country
 *   would show nothing. Keeps the dataset flag-renderable for all callers.
 * - Names are unique by folded label (playerSearch.fold), because consumers
 *   dedupe on it — that is why there is only one "Córdoba"-style entry per
 *   folded name.
 *
 * `aliases` are lowercase, accent-folded like `fold` folds the label. Add ASCII
 * spellings only where the folded label still is not ASCII — `ł`/`ø`/`æ` do not
 * fold (so "Wrocław" needs "wroclaw") while `ö`/`á`/`ã` do (so "Malmö" already
 * matches "malmo"). Native/English alternates ("münchen", "sevilla") let a
 * type-ahead feel real.
 */

/** One city: display name, its flag country (a FLAG_IMAGES key), and extra
 *  folded spellings a search should also match. */
export type City = {
  name: string;
  country: string;
  aliases?: string[];
};

export const CITIES: readonly City[] = [
  // Nordics
  {name: 'Copenhagen', country: 'Denmark', aliases: ['kobenhavn', 'københavn', 'kbh']},
  {name: 'Aarhus', country: 'Denmark', aliases: ['arhus', 'århus']},
  {name: 'Odense', country: 'Denmark'},
  {name: 'Aalborg', country: 'Denmark', aliases: ['alborg', 'ålborg']},
  {name: 'Esbjerg', country: 'Denmark'},
  {name: 'Stockholm', country: 'Sweden'},
  {name: 'Gothenburg', country: 'Sweden', aliases: ['goteborg', 'göteborg']},
  {name: 'Malmö', country: 'Sweden', aliases: ['malmo']},
  {name: 'Uppsala', country: 'Sweden'},
  {name: 'Oslo', country: 'Norway'},
  {name: 'Bergen', country: 'Norway'},
  {name: 'Trondheim', country: 'Norway'},
  {name: 'Stavanger', country: 'Norway'},
  {name: 'Helsinki', country: 'Finland', aliases: ['helsingfors']},
  {name: 'Tampere', country: 'Finland'},
  {name: 'Turku', country: 'Finland'},
  {name: 'Reykjavik', country: 'Iceland', aliases: ['reykjavík']},

  // British Isles
  {name: 'London', country: 'England', aliases: ['wembley']},
  {name: 'Manchester', country: 'England'},
  {name: 'Liverpool', country: 'England'},
  {name: 'Birmingham', country: 'England'},
  {name: 'Leeds', country: 'England'},
  {name: 'Newcastle', country: 'England', aliases: ['newcastle upon tyne']},
  {name: 'Sheffield', country: 'England'},
  {name: 'Bristol', country: 'England'},
  {name: 'Nottingham', country: 'England'},
  {name: 'Leicester', country: 'England'},
  {name: 'Cardiff', country: 'Wales', aliases: ['millennium stadium', 'principality stadium']},
  {name: 'Swansea', country: 'Wales'},
  {name: 'Glasgow', country: 'Scotland', aliases: ['hampden']},
  {name: 'Edinburgh', country: 'Scotland'},
  {name: 'Aberdeen', country: 'Scotland'},
  {name: 'Dundee', country: 'Scotland'},
  {name: 'Belfast', country: 'Northern Ireland'},
  {name: 'Dublin', country: 'Ireland'},
  {name: 'Cork', country: 'Ireland'},

  // France
  {name: 'Paris', country: 'France', aliases: ['stade de france', 'saint-denis']},
  {name: 'Marseille', country: 'France'},
  {name: 'Lyon', country: 'France'},
  {name: 'Lille', country: 'France'},
  {name: 'Bordeaux', country: 'France'},
  {name: 'Nice', country: 'France'},
  {name: 'Toulouse', country: 'France'},
  {name: 'Nantes', country: 'France'},
  {name: 'Saint-Étienne', country: 'France', aliases: ['saint etienne', 'st etienne']},
  {name: 'Lens', country: 'France'},
  {name: 'Strasbourg', country: 'France'},
  {name: 'Rennes', country: 'France'},

  // Spain
  {name: 'Madrid', country: 'Spain', aliases: ['metropolitano', 'santiago bernabeu', 'bernabeu']},
  {name: 'Barcelona', country: 'Spain', aliases: ['camp nou']},
  {name: 'Seville', country: 'Spain', aliases: ['sevilla']},
  {name: 'Valencia', country: 'Spain'},
  {name: 'Bilbao', country: 'Spain'},
  {name: 'Málaga', country: 'Spain', aliases: ['malaga']},
  {name: 'Zaragoza', country: 'Spain', aliases: ['saragossa']},
  {name: 'Vigo', country: 'Spain'},
  {name: 'San Sebastián', country: 'Spain', aliases: ['san sebastian', 'donostia']},
  {name: 'Granada', country: 'Spain'},

  // Germany
  {name: 'Berlin', country: 'Germany'},
  {name: 'Munich', country: 'Germany', aliases: ['munchen', 'münchen', 'allianz arena']},
  {name: 'Hamburg', country: 'Germany'},
  {name: 'Cologne', country: 'Germany', aliases: ['koln', 'köln']},
  {name: 'Frankfurt', country: 'Germany'},
  {name: 'Stuttgart', country: 'Germany'},
  {name: 'Dortmund', country: 'Germany'},
  {name: 'Düsseldorf', country: 'Germany', aliases: ['dusseldorf']},
  {name: 'Leipzig', country: 'Germany'},
  {name: 'Bremen', country: 'Germany'},
  {name: 'Gelsenkirchen', country: 'Germany'},
  {name: 'Mönchengladbach', country: 'Germany', aliases: ['monchengladbach', 'gladbach']},

  // Italy
  {name: 'Rome', country: 'Italy', aliases: ['roma', 'olimpico']},
  {name: 'Milan', country: 'Italy', aliases: ['milano', 'san siro']},
  {name: 'Naples', country: 'Italy', aliases: ['napoli']},
  {name: 'Turin', country: 'Italy', aliases: ['torino']},
  {name: 'Florence', country: 'Italy', aliases: ['firenze']},
  {name: 'Bologna', country: 'Italy'},
  {name: 'Genoa', country: 'Italy', aliases: ['genova']},
  {name: 'Venice', country: 'Italy', aliases: ['venezia']},
  {name: 'Palermo', country: 'Italy'},
  {name: 'Verona', country: 'Italy'},

  // Portugal
  {name: 'Lisbon', country: 'Portugal', aliases: ['lisboa', 'estadio da luz', 'luz']},
  {name: 'Porto', country: 'Portugal', aliases: ['dragao', 'estadio do dragao']},
  {name: 'Braga', country: 'Portugal'},
  {name: 'Guimarães', country: 'Portugal', aliases: ['guimaraes']},
  {name: 'Coimbra', country: 'Portugal'},
  {name: 'Faro', country: 'Portugal'},

  // Low Countries
  {name: 'Amsterdam', country: 'Netherlands', aliases: ['johan cruyff arena']},
  {name: 'Rotterdam', country: 'Netherlands', aliases: ['de kuip']},
  {name: 'Eindhoven', country: 'Netherlands'},
  {name: 'The Hague', country: 'Netherlands', aliases: ['den haag']},
  {name: 'Utrecht', country: 'Netherlands'},
  {name: 'Brussels', country: 'Belgium', aliases: ['bruxelles', 'brussel']},
  {name: 'Antwerp', country: 'Belgium', aliases: ['antwerpen']},
  {name: 'Bruges', country: 'Belgium', aliases: ['brugge']},
  {name: 'Ghent', country: 'Belgium', aliases: ['gent']},
  {name: 'Liège', country: 'Belgium', aliases: ['liege', 'luik']},

  // Alpine
  {name: 'Zurich', country: 'Switzerland', aliases: ['zürich']},
  {name: 'Geneva', country: 'Switzerland', aliases: ['geneve', 'genève', 'genf']},
  {name: 'Basel', country: 'Switzerland'},
  {name: 'Bern', country: 'Switzerland'},
  {name: 'Vienna', country: 'Austria', aliases: ['wien']},
  {name: 'Salzburg', country: 'Austria'},
  {name: 'Graz', country: 'Austria'},
  {name: 'Innsbruck', country: 'Austria'},

  // Central & Eastern Europe
  {name: 'Warsaw', country: 'Poland', aliases: ['warszawa']},
  {name: 'Kraków', country: 'Poland', aliases: ['krakow', 'cracow']},
  {name: 'Gdańsk', country: 'Poland', aliases: ['gdansk']},
  {name: 'Wrocław', country: 'Poland', aliases: ['wroclaw']},
  {name: 'Poznań', country: 'Poland', aliases: ['poznan']},
  {name: 'Prague', country: 'Czech Republic', aliases: ['praha']},
  {name: 'Brno', country: 'Czech Republic'},
  {name: 'Budapest', country: 'Hungary', aliases: ['puskas arena', 'puskás arena']},
  {name: 'Debrecen', country: 'Hungary'},
  {name: 'Bucharest', country: 'Romania', aliases: ['bucuresti', 'bucurești']},
  {name: 'Sofia', country: 'Bulgaria'},
  {name: 'Bratislava', country: 'Slovakia'},
  {name: 'Ljubljana', country: 'Slovenia'},
  {name: 'Zagreb', country: 'Croatia'},
  {name: 'Split', country: 'Croatia'},
  {name: 'Belgrade', country: 'Serbia', aliases: ['beograd']},
  {name: 'Novi Sad', country: 'Serbia'},
  {name: 'Sarajevo', country: 'Bosnia and Herzegovina'},
  {name: 'Mostar', country: 'Bosnia and Herzegovina'},
  {name: 'Skopje', country: 'North Macedonia'},
  {name: 'Podgorica', country: 'Montenegro'},
  {name: 'Pristina', country: 'Kosovo', aliases: ['prishtina', 'priština']},
  {name: 'Athens', country: 'Greece', aliases: ['athina', 'olympic stadium']},
  {name: 'Thessaloniki', country: 'Greece'},
  {name: 'Piraeus', country: 'Greece', aliases: ['pireas']},
  {name: 'Istanbul', country: 'Turkey', aliases: ['ataturk', 'atatürk']},
  {name: 'Ankara', country: 'Turkey'},
  {name: 'Izmir', country: 'Turkey', aliases: ['ízmir']},
  {name: 'Bursa', country: 'Turkey'},
  {name: 'Kyiv', country: 'Ukraine', aliases: ['kiev']},
  {name: 'Kharkiv', country: 'Ukraine', aliases: ['kharkov']},
  {name: 'Lviv', country: 'Ukraine', aliases: ['lvov']},
  {name: 'Donetsk', country: 'Ukraine'},
  {name: 'Odessa', country: 'Ukraine', aliases: ['odesa']},
  {name: 'Moscow', country: 'Russia', aliases: ['moskva', 'luzhniki']},
  {name: 'Saint Petersburg', country: 'Russia', aliases: ['st petersburg', 'petersburg', 'sankt-peterburg']},
  {name: 'Kazan', country: 'Russia'},
  {name: 'Sochi', country: 'Russia'},
  {name: 'Minsk', country: 'Belarus'},
  {name: 'Tbilisi', country: 'Georgia'},
  {name: 'Yerevan', country: 'Armenia'},

  // North & Central America
  {name: 'New York', country: 'USA', aliases: ['nyc', 'new york city']},
  {name: 'Los Angeles', country: 'USA', aliases: ['la']},
  {name: 'Chicago', country: 'USA'},
  {name: 'Miami', country: 'USA'},
  {name: 'Houston', country: 'USA'},
  {name: 'Dallas', country: 'USA'},
  {name: 'Boston', country: 'USA'},
  {name: 'Atlanta', country: 'USA'},
  {name: 'Seattle', country: 'USA'},
  {name: 'Washington', country: 'USA', aliases: ['washington dc', 'dc']},
  {name: 'San Francisco', country: 'USA'},
  {name: 'Philadelphia', country: 'USA'},
  {name: 'Toronto', country: 'Canada'},
  {name: 'Montreal', country: 'Canada', aliases: ['montréal']},
  {name: 'Vancouver', country: 'Canada'},
  {name: 'Mexico City', country: 'Mexico', aliases: ['ciudad de mexico', 'cdmx']},
  {name: 'Guadalajara', country: 'Mexico'},
  {name: 'Monterrey', country: 'Mexico'},
  {name: 'San José', country: 'Costa Rica', aliases: ['san jose']},
  {name: 'Tegucigalpa', country: 'Honduras'},
  {name: 'Panama City', country: 'Panama', aliases: ['panama']},

  // South America
  {name: 'Rio de Janeiro', country: 'Brazil', aliases: ['rio', 'maracana', 'maracanã']},
  {name: 'São Paulo', country: 'Brazil', aliases: ['sao paulo']},
  {name: 'Brasília', country: 'Brazil', aliases: ['brasilia']},
  {name: 'Salvador', country: 'Brazil'},
  {name: 'Belo Horizonte', country: 'Brazil'},
  {name: 'Porto Alegre', country: 'Brazil'},
  {name: 'Recife', country: 'Brazil'},
  {name: 'Buenos Aires', country: 'Argentina', aliases: ['la bombonera', 'monumental']},
  {name: 'Rosario', country: 'Argentina'},
  {name: 'Mendoza', country: 'Argentina'},
  {name: 'La Plata', country: 'Argentina'},
  {name: 'Montevideo', country: 'Uruguay'},
  {name: 'Santiago', country: 'Chile'},
  {name: 'Lima', country: 'Peru'},
  {name: 'Bogotá', country: 'Colombia', aliases: ['bogota']},
  {name: 'Medellín', country: 'Colombia', aliases: ['medellin']},
  {name: 'Cali', country: 'Colombia'},
  {name: 'Quito', country: 'Ecuador'},
  {name: 'Guayaquil', country: 'Ecuador'},
  {name: 'Asunción', country: 'Paraguay', aliases: ['asuncion']},
  {name: 'Caracas', country: 'Venezuela'},

  // Africa
  {name: 'Cairo', country: 'Egypt'},
  {name: 'Alexandria', country: 'Egypt'},
  {name: 'Casablanca', country: 'Morocco'},
  {name: 'Rabat', country: 'Morocco'},
  {name: 'Marrakesh', country: 'Morocco', aliases: ['marrakech']},
  {name: 'Algiers', country: 'Algeria'},
  {name: 'Tunis', country: 'Tunisia'},
  {name: 'Lagos', country: 'Nigeria'},
  {name: 'Abuja', country: 'Nigeria'},
  {name: 'Accra', country: 'Ghana'},
  {name: 'Dakar', country: 'Senegal'},
  {name: 'Johannesburg', country: 'South Africa', aliases: ['joburg', 'jozi']},
  {name: 'Cape Town', country: 'South Africa'},
  {name: 'Durban', country: 'South Africa'},
  {name: 'Pretoria', country: 'South Africa'},
  {name: 'Yaoundé', country: 'Cameroon', aliases: ['yaounde']},
  {name: 'Douala', country: 'Cameroon'},
  {name: 'Abidjan', country: 'Ivory Coast'},
  {name: 'Kinshasa', country: 'DR Congo'},
  {name: 'Harare', country: 'Zimbabwe'},
  {name: 'Lusaka', country: 'Zambia'},
  {name: 'Kampala', country: 'Uganda'},
  {name: 'Bamako', country: 'Mali'},
  {name: 'Conakry', country: 'Guinea'},
  {name: 'Libreville', country: 'Gabon'},
  {name: 'Banjul', country: 'Gambia'},
  {name: 'Lomé', country: 'Togo', aliases: ['lome']},
  {name: 'Monrovia', country: 'Liberia'},
  {name: 'Maputo', country: 'Mozambique'},

  // Middle East, Asia & Oceania
  {name: 'Tokyo', country: 'Japan'},
  {name: 'Osaka', country: 'Japan'},
  {name: 'Yokohama', country: 'Japan'},
  {name: 'Nagoya', country: 'Japan'},
  {name: 'Seoul', country: 'South Korea'},
  {name: 'Busan', country: 'South Korea'},
  {name: 'Incheon', country: 'South Korea'},
  {name: 'Doha', country: 'Qatar', aliases: ['lusail']},
  {name: 'Riyadh', country: 'Saudi Arabia'},
  {name: 'Jeddah', country: 'Saudi Arabia'},
  {name: 'Amman', country: 'Jordan'},
  {name: 'Tehran', country: 'Iran'},
  {name: 'Tashkent', country: 'Uzbekistan'},
  {name: 'Sydney', country: 'Australia'},
  {name: 'Melbourne', country: 'Australia'},
  {name: 'Brisbane', country: 'Australia'},
  {name: 'Perth', country: 'Australia'},
  {name: 'Auckland', country: 'New Zealand'},
  {name: 'Wellington', country: 'New Zealand'},
  {name: 'Kingston', country: 'Jamaica'},
  {name: 'Port of Spain', country: 'Trinidad and Tobago'},
  {name: 'Willemstad', country: 'Curacao'},
];
