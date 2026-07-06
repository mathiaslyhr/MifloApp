/**
 * Grid generation for the football tic-tac-toe. Picks 3 row + 3 col criteria
 * such that EVERY one of the 9 cells (row ∩ col) has at least one valid
 * footballer — otherwise the grid isn't solvable.
 *
 * Strategy: build a candidate pool of well-populated criteria (clubs, nations,
 * honours, shirt numbers, "played with X"), precompute each one's footballer-id
 * set, then randomly pick
 * 3 rows and greedily find 3 cols whose intersection with all rows clears a
 * threshold. Try for ≥2 per cell (fairer), fall back to ≥1 (always solvable).
 */
import {
  CLUBS,
  FOOTBALLERS,
  getById,
  getClub,
  HONOUR_LABELS,
  matches,
  POSITION_LABELS,
  shuffle,
  type Criterion,
  type Rng,
} from '../../data/football';

const LEAGUE_LABELS: Record<string, string> = {
  'premier-league': 'Premier League',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  bundesliga: 'Bundesliga',
  'ligue-1': 'Ligue 1',
};

const TAG_LABELS: Record<string, string> = {
  legends: 'Legends',
  'current-stars': 'Current stars',
};

// ---------------------------------------------------------------- short labels
// The grid axis chips are tiny, so long names ("Manchester United") wrap to two
// lines and look broken. These maps give every axis criterion a ≤7-char label
// for the grid ONLY — the picker/search still shows the full `criterionLabel`.

const CLUB_SHORT: Record<string, string> = {
  'man-city': 'Man C', 'man-utd': 'Man U', arsenal: 'Arsenal', chelsea: 'Chelsea',
  liverpool: "L'pool", tottenham: 'Spurs', 'aston-villa': 'Villa', everton: 'Everton',
  newcastle: 'Newc.', 'west-ham': 'Hammers', leicester: 'Leic.', leeds: 'Leeds',
  wolves: 'Wolves', southampton: 'Saints', qpr: 'QPR', fulham: 'Fulham', barnsley: 'Barns.',
  'real-madrid': 'Real', barcelona: 'Barça', 'atletico-madrid': 'Atléti', sevilla: 'Sevilla',
  valencia: 'Valen.', villarreal: 'Villar.', 'real-sociedad': 'R. Soc', 'real-betis': 'Betis',
  juventus: 'Juve', inter: 'Inter', 'ac-milan': 'Milan', napoli: 'Napoli', roma: 'Roma',
  lazio: 'Lazio', fiorentina: 'Viola', atalanta: 'Atal.', bologna: 'Bologna',
  bayern: 'Bayern', dortmund: 'BVB', leverkusen: 'Lever.', schalke: 'Schalke',
  'rb-leipzig': 'Leipzig', wolfsburg: 'Wolfs.', monchengladbach: 'Gladb.',
  psg: 'PSG', monaco: 'Monaco', marseille: 'OM', lyon: 'Lyon', lille: 'Lille',
  rennes: 'Rennes', 'paris-fc': 'PFC',
  'inter-miami': 'Miami', lafc: 'LAFC', 'la-galaxy': 'Galaxy', vancouver: 'Vanc.',
  'al-nassr': 'Nassr', 'al-hilal': 'Hilal', 'al-ittihad': 'Ittihad', 'al-qadsiah': 'Qadsiah',
  'al-ahli': 'Al Ahli', sporting: 'Sport.', benfica: 'Benfica', porto: 'Porto', ajax: 'Ajax',
  santos: 'Santos', fluminense: 'Flumi.', flamengo: 'Flam.', palmeiras: 'Palm.',
  'boca-juniors': 'Boca', 'river-plate': 'River', 'rosario-central': 'Rosario',
  monterrey: 'Monter.', galatasaray: 'Gala', besiktas: 'Beşik.', fenerbahce: 'Fener.',
  celtic: 'Celtic',
  'nottingham-forest': 'Forest', 'crystal-palace': 'Palace', bournemouth: 'Bmouth',
  burnley: 'Burnley', brentford: 'Brent.', 'werder-bremen': 'Bremen', psv: 'PSV',
  feyenoord: 'Feyen.', genoa: 'Genoa', nice: 'Nice', 'club-brugge': 'Brugge',
  'club-america': 'América', guadalajara: 'Chivas', tigres: 'Tigres',
  'cruz-azul': 'Cruz A.', pumas: 'Pumas', pachuca: 'Pachuca', toluca: 'Toluca',
  'real-mallorca': 'Mall.', brighton: 'Brigh.', anderlecht: 'Ander.', twente: 'Twente',
  girona: 'Girona', 'eintracht-frankfurt': 'Eintr.', 'vfb-stuttgart': 'Stutt.',
  freiburg: 'Freib.', parma: 'Parma', genk: 'Genk', lens: 'Lens',
  montpellier: 'Montp.', 'al-sadd': 'Al Sadd', 'al-duhail': 'Duhail', reims: 'Reims',
  'athletic-bilbao': 'Bilbao', torino: 'Torino', nantes: 'Nantes', 'al-ahly': 'Al Ahly',
  'mamelodi-sundowns': 'Sundw.', toulouse: 'Toul.', metz: 'Metz', lorient: 'Lorient',
  empoli: 'Empoli', udinese: 'Udin.', trabzonspor: 'Trab.', sunderland: 'Sund.',
  'bristol-city': 'Bristol', 'union-sg': 'USG', basel: 'Basel',
  getafe: 'Getafe', como: 'Como', internacional: 'Inter P', botafogo: 'Botaf.',
  watford: 'Watford', cagliari: 'Cagli.', 'hertha-berlin': 'Hertha', 'west-brom': 'WBA',
  hoffenheim: 'Hoff.', 'union-berlin': 'Union', mainz: 'Mainz', 'az-alkmaar': 'AZ',
  lecce: 'Lecce', sampdoria: 'Samp.', 'sheffield-united': 'Sheff U', salzburg: 'Salz.',
  'dinamo-zagreb': 'D.Zag.', midtjylland: 'Midt.', copenhagen: 'Copen.', shakhtar: 'Shakh.',
  'dynamo-kyiv': 'D.Kyiv', ferencvaros: 'Ferenc', olympiacos: 'Olymp.',
  augsburg: 'Augsb.', spezia: 'Spezia', norwich: 'Norwich', 'al-shabab': 'Shabab',
  dnipro: 'Dnipro',
};

/** Country → short 3-letter code (a flag is shown alongside it). */
const NATION_SHORT: Record<string, string> = {
  Algeria: 'ALG', Angola: 'ANG', Argentina: 'ARG', Armenia: 'ARM', Australia: 'AUS',
  Austria: 'AUT', Belgium: 'BEL', Bolivia: 'BOL', 'Bosnia and Herzegovina': 'BIH',
  Brazil: 'BRA', Bulgaria: 'BUL', 'Burkina Faso': 'BFA', Cameroon: 'CMR', Canada: 'CAN',
  'Cape Verde': 'CPV', Chile: 'CHI', China: 'CHN', Colombia: 'COL', 'Costa Rica': 'CRC',
  Croatia: 'CRO', Curacao: 'CUW', 'Czech Republic': 'CZE', 'DR Congo': 'COD', Denmark: 'DEN',
  Ecuador: 'ECU', Egypt: 'EGY', England: 'ENG', 'Equatorial Guinea': 'EQG', Finland: 'FIN',
  France: 'FRA', Gabon: 'GAB', Georgia: 'GEO', Germany: 'GER', Ghana: 'GHA', Greece: 'GRE',
  Guinea: 'GUI', Honduras: 'HON', Hungary: 'HUN', Iceland: 'ISL', 'Ivory Coast': 'CIV',
  Iran: 'IRN', Iraq: 'IRQ', Ireland: 'IRL', Israel: 'ISR', Italy: 'ITA', Jamaica: 'JAM',
  Japan: 'JPN', Jordan: 'JOR', Kosovo: 'KOS', Liberia: 'LBR', Mali: 'MLI', Mexico: 'MEX', Montenegro: 'MNE',
  Morocco: 'MAR', Netherlands: 'NED', 'New Zealand': 'NZL', Nigeria: 'NGA',
  'North Macedonia': 'MKD', 'Northern Ireland': 'NIR', Norway: 'NOR', Panama: 'PAN',
  Paraguay: 'PAR', Peru: 'PER', Poland: 'POL', Portugal: 'POR', Qatar: 'QAT', Romania: 'ROU',
  Russia: 'RUS', 'Saudi Arabia': 'KSA', Scotland: 'SCO', Senegal: 'SEN', Serbia: 'SRB',
  Slovakia: 'SVK', Slovenia: 'SVN', 'South Africa': 'RSA', 'South Korea': 'KOR', Spain: 'ESP',
  Sweden: 'SWE', Switzerland: 'SUI', Togo: 'TOG', 'Trinidad and Tobago': 'TRI', Tunisia: 'TUN',
  Turkey: 'TUR', Ukraine: 'UKR', 'United Arab Emirates': 'UAE', Uruguay: 'URU', USA: 'USA',
  Uzbekistan: 'UZB', Venezuela: 'VEN', Wales: 'WAL', Zambia: 'ZAM', Zimbabwe: 'ZIM',
};

const HONOUR_SHORT: Record<string, string> = {
  'champions-league': 'UCL', 'europa-league': 'UEL', 'world-cup': 'WC',
  'european-championship': 'Euros', 'league-title': 'League', 'domestic-cup': 'Cup',
  'ballon-dor': 'Ballon', 'golden-boot': 'Boot', 'copa-america': 'Copa',
  'player-of-the-season': 'POTS',
};

const LEAGUE_SHORT: Record<string, string> = {
  'premier-league': 'PL', 'la-liga': 'La Liga', 'serie-a': 'Serie A',
  bundesliga: 'Bundes.', 'ligue-1': 'Ligue 1',
};

const TAG_SHORT: Record<string, string> = {legends: 'Legends', 'current-stars': 'Stars'};

/** Player's display name for a teammate axis, e.g. 'Lionel Messi'. */
function teammateName(playerId: string): string {
  return getById(playerId)?.name ?? playerId;
}

/** Surname only (last token of the display name), for the tiny grid chips. */
function teammateSurname(playerId: string): string {
  const name = teammateName(playerId);
  return name.split(' ').pop() ?? name;
}

/** Full human label for an axis chip — used by the picker/search. */
export function criterionLabel(c: Criterion): string {
  switch (c.kind) {
    case 'club':
      return getClub(c.clubId)?.name ?? c.clubId;
    case 'league':
      return LEAGUE_LABELS[c.league] ?? c.league;
    case 'nationality':
      return c.country;
    case 'position':
      return POSITION_LABELS[c.position];
    case 'honour':
      return HONOUR_LABELS[c.honour];
    case 'tag':
      return TAG_LABELS[c.tag] ?? c.tag;
    case 'shirtNumber':
      return `No. ${c.number}`;
    case 'teammate':
      return `Played with ${teammateName(c.playerId)}`;
  }
}

/** Compact ≤7-char label for the tiny grid axis chips. */
export function criterionShortLabel(c: Criterion): string {
  switch (c.kind) {
    case 'club':
      return CLUB_SHORT[c.clubId] ?? getClub(c.clubId)?.name ?? c.clubId;
    case 'league':
      return LEAGUE_SHORT[c.league] ?? LEAGUE_LABELS[c.league] ?? c.league;
    case 'nationality':
      return NATION_SHORT[c.country] ?? c.country;
    case 'position':
      return POSITION_LABELS[c.position];
    case 'honour':
      return HONOUR_SHORT[c.honour] ?? HONOUR_LABELS[c.honour];
    case 'tag':
      return TAG_SHORT[c.tag] ?? TAG_LABELS[c.tag] ?? c.tag;
    case 'shirtNumber':
      return `#${c.number}`;
    case 'teammate':
      return teammateSurname(c.playerId);
  }
}

function sameCriterion(a: Criterion, b: Criterion): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Minimum footballers a criterion needs to be a usable axis. */
const MIN_AXIS = 4;

/** Iconic shirt numbers offered as axes (kept only if ≥ MIN_AXIS players). */
const AXIS_SHIRT_NUMBERS = [7, 9, 10, 11, 8] as const;

/**
 * Well-connected "hub" players offered as "played with X" axes. Anyone with
 * fewer than MIN_AXIS in-dataset teammates is dropped by the filter below, so
 * this list can be generous. Ids match footballers.ts ("Surname, First").
 */
const AXIS_TEAMMATES = [
  'Messi, Lionel', 'Ronaldo, Cristiano', 'Xavi', 'Iniesta, Andrés',
  'Busquets, Sergio', 'Ramos, Sergio', 'Modrić, Luka', 'Benzema, Karim',
  'Neymar', 'Suárez, Luis', 'Ibrahimović, Zlatan', 'Lampard, Frank',
  'Gerrard, Steven', 'De Bruyne, Kevin', 'Kroos, Toni', 'Müller, Thomas',
  'Buffon, Gianluigi', 'Totti, Francesco', 'Pirlo, Andrea', 'Maldini, Paolo',
] as const;

type Candidate = {c: Criterion; ids: Set<string>};

function buildCandidates(): Candidate[] {
  const criteria: Criterion[] = [];

  // Clubs.
  for (const club of CLUBS) {
    criteria.push({kind: 'club', clubId: club.id});
  }
  // Nations (distinct across the dataset).
  const nations = new Set<string>();
  for (const f of FOOTBALLERS) {
    f.nationality.forEach(n => nations.add(n));
  }
  nations.forEach(country => criteria.push({kind: 'nationality', country}));
  // Honours for spice.
  (
    [
      'champions-league', 'world-cup', 'ballon-dor', 'golden-boot',
      'european-championship', 'copa-america', 'europa-league',
    ] as const
  ).forEach(honour => criteria.push({kind: 'honour', honour}));
  // Iconic shirt numbers.
  AXIS_SHIRT_NUMBERS.forEach(number =>
    criteria.push({kind: 'shirtNumber', number}),
  );
  // "Played with X" — only for hub players that actually exist in the dataset.
  AXIS_TEAMMATES.filter(id => getById(id)).forEach(playerId =>
    criteria.push({kind: 'teammate', playerId}),
  );

  return criteria
    .map(c => ({
      c,
      ids: new Set(FOOTBALLERS.filter(f => matches(f, c)).map(f => f.id)),
    }))
    .filter(cand => cand.ids.size >= MIN_AXIS);
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let n = 0;
  small.forEach(id => {
    if (big.has(id)) {
      n++;
    }
  });
  return n;
}

export type Grid = {rows: Criterion[]; cols: Criterion[]};

/**
 * Max axes of each "special" kind allowed on a whole 6-axis grid. The fat
 * teammate/number axes otherwise dominate (they intersect everything), so a
 * whole side could come up all "Played with X". Clubs & nations are uncapped —
 * a side of 3 clubs is a classic football-grid look. Kinds absent here have no
 * cap. These caps also stop any side being monotone in a special kind.
 */
const KIND_CAP: Partial<Record<Criterion['kind'], number>> = {
  teammate: 1,
  shirtNumber: 1,
  honour: 2,
};

export function generateGrid(rng: Rng = Math.random): Grid {
  const pool = buildCandidates();

  const attempt = (minPer: number): Grid | null => {
    for (let i = 0; i < 600; i++) {
      const shuffled = shuffle(pool, rng);
      const used: Partial<Record<Criterion['kind'], number>> = {};
      const withinCap = (cand: Candidate): boolean => {
        const cap = KIND_CAP[cand.c.kind];
        return cap === undefined || (used[cand.c.kind] ?? 0) < cap;
      };
      const take = (cand: Candidate): void => {
        used[cand.c.kind] = (used[cand.c.kind] ?? 0) + 1;
      };

      // Rows: first 3 (in shuffled order) that respect the per-kind caps.
      const rows: Candidate[] = [];
      for (const cand of shuffled) {
        if (rows.length === 3) {
          break;
        }
        if (!withinCap(cand)) {
          continue;
        }
        rows.push(cand);
        take(cand);
      }
      if (rows.length < 3) {
        continue;
      }

      // Cols: distinct, cap-respecting, and ≥ minPer with every row.
      const cols: Candidate[] = [];
      for (const cand of shuffled) {
        if (cols.length === 3) {
          break;
        }
        if (rows.some(r => sameCriterion(r.c, cand.c))) {
          continue;
        }
        if (cols.some(cc => sameCriterion(cc.c, cand.c))) {
          continue;
        }
        if (!withinCap(cand)) {
          continue;
        }
        if (rows.every(r => intersectionSize(r.ids, cand.ids) >= minPer)) {
          cols.push(cand);
          take(cand);
        }
      }
      if (cols.length === 3) {
        return {rows: rows.map(r => r.c), cols: cols.map(c => c.c)};
      }
    }
    return null;
  };

  const grid = attempt(2) ?? attempt(1);
  if (!grid) {
    throw new Error('Could not generate a solvable tic-tac-toe grid');
  }
  return grid;
}
