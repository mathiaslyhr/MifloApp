// Art-source maps: how to fetch a real flag / crest for a dataset country / club.
//
// CommonJS (not .mjs) on purpose: this file is imported BOTH by the node ESM
// asset scripts (via node's CJS interop) AND by the jest data-integrity suite —
// and jest's default transform skips `.mjs`, so a CJS `.js` is the one format
// both toolchains load cleanly. Pure data + one helper, no node built-ins and no
// `sharp`. The integrity gate uses it to answer "can art for this country/club
// be produced?" without any network I/O; see ./art.mjs for the fetch layer.
//
//   COUNTRY_ISO[country] → flagcdn ISO code (flag PNG source)
//   CLUB_SLUG[clubId]     → footylogos slug (crest SVG source)
//
// Adding a new nation OR a new not-yet-bundled club that must ship its art
// over-the-air REQUIRES an entry here (the integrity test enforces it); the
// slugify() fallback only covers clubs whose art is already bundled.

// Country name (as used in the dataset) → flagcdn code (ISO 3166-1 alpha-2,
// lowercase; home nations use the gb-* subdivision codes flagcdn supports).
// Deliberately broad so future dataset batches rarely need a code added.
const COUNTRY_ISO = {
  Algeria: 'dz', Angola: 'ao', Argentina: 'ar', Armenia: 'am', Australia: 'au',
  Austria: 'at', Belarus: 'by', Belgium: 'be', Bolivia: 'bo', 'Bosnia and Herzegovina': 'ba',
  Brazil: 'br', Bulgaria: 'bg', 'Burkina Faso': 'bf', Cameroon: 'cm', Canada: 'ca',
  'Cape Verde': 'cv', Chile: 'cl', China: 'cn', Colombia: 'co', 'Costa Rica': 'cr',
  Croatia: 'hr', Curacao: 'cw', 'Czech Republic': 'cz', 'DR Congo': 'cd',
  Denmark: 'dk', Ecuador: 'ec', Egypt: 'eg', England: 'gb-eng',
  'Equatorial Guinea': 'gq', Finland: 'fi', France: 'fr', Gabon: 'ga',
  Gambia: 'gm', Georgia: 'ge', Germany: 'de', Ghana: 'gh', Greece: 'gr', Guinea: 'gn',
  Honduras: 'hn', Hungary: 'hu', Iceland: 'is', 'Ivory Coast': 'ci', Iran: 'ir',
  Iraq: 'iq', Ireland: 'ie', Israel: 'il', Italy: 'it', Jamaica: 'jm',
  Japan: 'jp', Jordan: 'jo', Kosovo: 'xk', Liberia: 'lr', Mali: 'ml', Mexico: 'mx',
  Montenegro: 'me', Morocco: 'ma', Mozambique: 'mz', Netherlands: 'nl', 'New Zealand': 'nz',
  Nigeria: 'ng', 'North Macedonia': 'mk', 'Northern Ireland': 'gb-nir',
  Norway: 'no', Panama: 'pa', Paraguay: 'py', Peru: 'pe', Poland: 'pl',
  Portugal: 'pt', Qatar: 'qa', Romania: 'ro', Russia: 'ru', 'Saudi Arabia': 'sa',
  Scotland: 'gb-sct', Senegal: 'sn', Serbia: 'rs', Slovakia: 'sk',
  Slovenia: 'si', 'South Africa': 'za', 'South Korea': 'kr', Spain: 'es',
  Sweden: 'se', Switzerland: 'ch', Togo: 'tg', 'Trinidad and Tobago': 'tt',
  Tunisia: 'tn', Turkey: 'tr', Ukraine: 'ua', 'United Arab Emirates': 'ae',
  Uruguay: 'uy', USA: 'us', Uzbekistan: 'uz', Venezuela: 've', Wales: 'gb-wls',
  Uganda: 'ug', Zambia: 'zm', Zimbabwe: 'zw',
};

// clubId → footylogos slug (verified via probe; extend per dataset batch).
const CLUB_SLUG = {
  agf: 'agf-aarhus', viborg: 'viborg-ff', cadiz: 'cadiz-cf',
  // slugify() turns "D.C. United" into "d-c-united", which 404s.
  'dc-united': 'dc-united',
  'man-city': 'manchester-city', 'man-utd': 'manchester-united',
  arsenal: 'arsenal', chelsea: 'chelsea', liverpool: 'liverpool-fc',
  tottenham: 'tottenham-hotspur', 'aston-villa': 'aston-villa',
  everton: 'everton', newcastle: 'newcastle-united', 'west-ham': 'west-ham-united',
  leicester: 'leicester', leeds: 'leeds-united', wolves: 'wolverhampton-wanderers',
  southampton: 'southampton', qpr: 'queens-park-rangers', barnsley: 'barnsley',
  fulham: 'fulham',
  'real-madrid': 'real-madrid', barcelona: 'fc-barcelona',
  'atletico-madrid': 'atletico-madrid', sevilla: 'sevilla-fc', valencia: 'valencia-cf',
  villarreal: 'villarreal-cf', 'real-sociedad': 'real-sociedad',
  'real-betis': 'real-betis-balompie', juventus: 'juventus', inter: 'inter-milan',
  'ac-milan': 'ac-milan', napoli: 'napoli', roma: 'roma', lazio: 'lazio',
  fiorentina: 'fiorentina', atalanta: 'atalanta', bologna: 'bologna',
  bayern: 'bayern-munich', dortmund: 'borussia-dortmund', leverkusen: 'bayer-leverkusen',
  schalke: 'schalke-04', 'rb-leipzig': 'rb-leipzig', wolfsburg: 'vfl-wolfsburg',
  monchengladbach: 'borussia-monchengladbach', psg: 'paris-saint-germain-psg',
  monaco: 'as-monaco', marseille: 'olympique-de-marseille-om', lyon: 'olympique-lyonnais',
  lille: 'losc-lille', rennes: 'stade-rennais', 'paris-fc': 'paris-fc',
  'inter-miami': 'inter-miami', lafc: 'los-angeles-fc', 'la-galaxy': 'la-galaxy',
  vancouver: 'vancouver-whitecaps', 'al-nassr': 'al-nassr', 'al-hilal': 'al-hilal',
  'al-ittihad': 'al-ittihad', 'al-qadsiah': 'al-qadsiah', 'al-ahli': 'al-ahli',
  sporting: 'sporting-cp', benfica: 'sl-benfica', porto: 'fc-porto', ajax: 'ajax',
  santos: 'santos-fc', fluminense: 'fluminense', flamengo: 'flamengo',
  palmeiras: 'palmeiras',
  'boca-juniors': 'boca-juniors', 'river-plate': 'river-plate',
  'rosario-central': 'rosario-central', monterrey: 'monterrey',
  galatasaray: 'galatasaray', besiktas: 'besiktas', celtic: 'celtic',
  fenerbahce: 'fenerbahce',
  // WC 2026 batch: CONCACAF / hosts / OFC
  'nottingham-forest': 'nottingham-forest', 'crystal-palace': 'crystal-palace',
  bournemouth: 'afc-bournemouth', burnley: 'burnley', brentford: 'brentford',
  'werder-bremen': 'werder-bremen', psv: 'psv-eindhoven', feyenoord: 'feyenoord',
  genoa: 'genoa', nice: 'ogc-nice', 'club-brugge': 'club-brugge',
  'club-america': 'club-america', guadalajara: 'cd-guadalajara',
  tigres: 'tigres-uanl', 'cruz-azul': 'cruz-azul', pumas: 'pumas-unam',
  pachuca: 'pachuca', toluca: 'toluca', 'real-mallorca': 'rcd-mallorca',
  brighton: 'brighton-and-hove-albion', anderlecht: 'rsc-anderlecht', twente: 'fc-twente',
  girona: 'girona-fc',
  // WC 2026 batch: AFC
  'eintracht-frankfurt': 'eintracht-frankfurt', 'vfb-stuttgart': 'vfb-stuttgart',
  freiburg: 'sc-freiburg', parma: 'parma', genk: 'krc-genk', lens: 'rc-lens',
  montpellier: 'montpellier', 'al-sadd': 'al-sadd-sc', 'al-duhail': 'al-duhail-sc',
  reims: 'stade-de-reims',
  // WC 2026 batch: CAF
  'athletic-bilbao': 'athletic-club-bilbao', torino: 'torino', nantes: 'fc-nantes',
  'al-ahly': 'al-ahly-sc', 'mamelodi-sundowns': 'mamelodi-sundowns',
  toulouse: 'toulouse-fc', metz: 'fc-metz', lorient: 'fc-lorient', empoli: 'empoli-fc',
  udinese: 'udinese', trabzonspor: 'trabzonspor', sunderland: 'sunderland',
  bastia: 'sc-bastia',
  'bristol-city': 'bristol-city', 'union-sg': 'union-saint-gilloise', basel: 'fc-basel',
  // WC 2026 batch: CONMEBOL
  getafe: 'getafe-cf', como: 'como-1907', internacional: 'sc-internacional', botafogo: 'botafogo',
  watford: 'watford', cagliari: 'cagliari', 'hertha-berlin': 'hertha-bsc', 'west-brom': 'west-bromwich-albion',
  // WC 2026 batch: UEFA
  hoffenheim: 'tsg-hoffenheim', 'union-berlin': 'union-berlin', mainz: 'mainz-05',
  'az-alkmaar': 'az-alkmaar', lecce: 'lecce', sampdoria: 'uc-sampdoria',
  'hellas-verona': 'hellas-verona',
  'sheffield-united': 'sheffield-united', salzburg: 'red-bull-salzburg',
  'dinamo-zagreb': 'gnk-dinamo-zagreb', midtjylland: 'fc-midtjylland', copenhagen: 'fc-copenhagen',
  shakhtar: 'shakhtar-donetsk', 'dynamo-kyiv': 'dynamo-kyiv', ferencvaros: 'ferencvaros-tc',
  olympiacos: 'olympiacos', augsburg: 'fc-augsburg', spezia: 'spezia',
  norwich: 'norwich-city', 'al-shabab': 'al-shabab',
  // Curation batch 2026-07
  gremio: 'gremio', hamburg: 'hamburger-sv', blackburn: 'blackburn-rovers',
  'celta-vigo': 'celta-vigo', corinthians: 'corinthians',
  stoke: 'stoke-city', bolton: 'bolton-wanderers',
  kaiserslautern: 'fc-kaiserslautern', 'saint-etienne': 'as-saint-etienne',
  elche: 'elche-cf', cannes: 'as-cannes',
  'orlando-city': 'orlando-city',
  // Wave B (famous-lineup legends) 2026-07
  deportivo: 'deportivo-la-coruna', koln: '1-fc-koln',
  brondby: 'brondby-if', 'aek-athens': 'aek-athens',
  // Recent moves 2026-07
  braga: 'sc-braga', panathinaikos: 'panathinaikos',
  'rayo-vallecano': 'rayo-vallecano', 'orlando-pirates': 'orlando-pirates',
  'chicago-fire': 'chicago-fire',
  // Transfers 2026-07
  ipswich: 'ipswich-town',
};

const slugify = s =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

module.exports = {COUNTRY_ISO, CLUB_SLUG, slugify};
