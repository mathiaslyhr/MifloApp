/**
 * Grid generation for the football hattrick. Picks 3 row + 3 col criteria
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
  derivedFromData,
  FOOTBALLERS,
  getById,
  getClub,
  getManagerById,
  HONOUR_LABELS,
  matches,
  POSITION_LABELS,
  shuffle,
  type Criterion,
  type Rng,
} from '../../data/football';
import {famePrior} from '../cult-hero/famePrior';
import {PLAYER_AVATARS} from './assets/playerAvatars';

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
// lines and look broken. These maps give every axis criterion a 3-letter code
// (MUN, ESP, …) for the grid ONLY — picker/search still shows `criterionLabel`.

/** Club id → 3-letter code (the crest is shown alongside it). */
const CLUB_SHORT: Record<string, string> = {
  'man-city': 'MCI', 'man-utd': 'MUN', arsenal: 'ARS', chelsea: 'CHE',
  liverpool: 'LIV', tottenham: 'TOT', 'aston-villa': 'AVA', everton: 'EVE',
  newcastle: 'NEW', 'west-ham': 'WHU', leicester: 'LEI', leeds: 'LEE',
  wolves: 'WOL', southampton: 'SOU', qpr: 'QPR', fulham: 'FUL', barnsley: 'BNS',
  'real-madrid': 'RMA', barcelona: 'BAR', 'atletico-madrid': 'ATM', sevilla: 'SEV',
  valencia: 'VAL', villarreal: 'VIL', 'real-sociedad': 'RSO', 'real-betis': 'BET',
  juventus: 'JUV', inter: 'INT', 'ac-milan': 'ACM', napoli: 'NAP', roma: 'ROM',
  lazio: 'LAZ', fiorentina: 'FIO', atalanta: 'ATA', bologna: 'BOL',
  bayern: 'BAY', dortmund: 'BVB', leverkusen: 'LEV', schalke: 'SCH',
  'rb-leipzig': 'RBL', wolfsburg: 'WOB', monchengladbach: 'BMG',
  psg: 'PSG', monaco: 'AMO', marseille: 'MRS', lyon: 'LYO', lille: 'LIL',
  rennes: 'REN', 'paris-fc': 'PFC',
  'inter-miami': 'MIA', lafc: 'LAF', 'la-galaxy': 'LAG', vancouver: 'VAN',
  'al-nassr': 'NAS', 'al-hilal': 'HIL', 'al-ittihad': 'ITT', 'al-qadsiah': 'QAD',
  'al-ahli': 'AHL', sporting: 'SCP', benfica: 'BEN', porto: 'FCP', ajax: 'AJA',
  santos: 'SAN', fluminense: 'FLU', flamengo: 'FLA', palmeiras: 'PAL',
  'boca-juniors': 'BOC', 'river-plate': 'RIV', 'rosario-central': 'ROS',
  monterrey: 'MTY', galatasaray: 'GAL', besiktas: 'BES', fenerbahce: 'FEN',
  celtic: 'CEL',
  'nottingham-forest': 'NFO', 'crystal-palace': 'CRY', bournemouth: 'BOU',
  burnley: 'BUR', brentford: 'BRE', 'werder-bremen': 'WER', psv: 'PSV',
  feyenoord: 'FEY', genoa: 'GEN', nice: 'NIC', 'club-brugge': 'BRU',
  'club-america': 'AME', guadalajara: 'GDL', tigres: 'TIG',
  'cruz-azul': 'CAZ', pumas: 'PUM', pachuca: 'PAC', toluca: 'TOL',
  'real-mallorca': 'MLL', brighton: 'BHA', anderlecht: 'AND', twente: 'TWE',
  girona: 'GIR', 'eintracht-frankfurt': 'EIN', 'vfb-stuttgart': 'VFB',
  freiburg: 'FRE', parma: 'PMA', genk: 'GNK', lens: 'LEN',
  montpellier: 'MTP', 'al-sadd': 'SAD', 'al-duhail': 'DUH', reims: 'REI',
  'athletic-bilbao': 'ATH', torino: 'TOR', nantes: 'NAN', 'al-ahly': 'AHY',
  'mamelodi-sundowns': 'SDW', toulouse: 'TOU', metz: 'MET', lorient: 'LOR',
  empoli: 'EMP', udinese: 'UDI', trabzonspor: 'TRA', sunderland: 'SUN',
  'bristol-city': 'BRC', 'union-sg': 'USG', basel: 'BAS',
  getafe: 'GET', como: 'COM', internacional: 'INL', botafogo: 'BOT',
  watford: 'WAT', cagliari: 'CAG', 'hertha-berlin': 'HER', 'west-brom': 'WBA',
  hoffenheim: 'HOF', 'union-berlin': 'UNB', mainz: 'MAI', 'az-alkmaar': 'AZA',
  lecce: 'LEC', sampdoria: 'SAM', 'hellas-verona': 'VER', 'sheffield-united': 'SHU',
  salzburg: 'SAL', 'dinamo-zagreb': 'DZG', midtjylland: 'FCM', copenhagen: 'FCK',
  shakhtar: 'SHK', 'dynamo-kyiv': 'DYK', ferencvaros: 'FER', olympiacos: 'OLY',
  augsburg: 'AUG', spezia: 'SPE', norwich: 'NCI', 'al-shabab': 'SHB',
  gremio: 'GRM', hamburg: 'HSV', blackburn: 'BLA',
  'celta-vigo': 'CLV', corinthians: 'COR',
  stoke: 'STO', bolton: 'BOW', kaiserslautern: 'KAI',
  'saint-etienne': 'STE', elche: 'ELC', cannes: 'ACA',
  'orlando-city': 'ORL',
  deportivo: 'DEP', koln: 'KOE', brondby: 'BIF', 'aek-athens': 'AEK',
  ipswich: 'IPS',
};

/** Country → short 3-letter code (a flag is shown alongside it). */
const NATION_SHORT: Record<string, string> = {
  Algeria: 'ALG', Angola: 'ANG', Argentina: 'ARG', Armenia: 'ARM', Australia: 'AUS',
  Austria: 'AUT', Belarus: 'BLR', Belgium: 'BEL', Bolivia: 'BOL', 'Bosnia and Herzegovina': 'BIH',
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
  'european-championship': 'Euros', 'league-title': 'League title', 'domestic-cup': 'Domestic cup',
  'ballon-dor': 'Ballon', 'golden-boot': 'Golden Boot', 'copa-america': 'Copa',
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

/** Manager's display name for a managed-by axis, e.g. 'Pep Guardiola'. */
function managerName(managerId: string): string {
  return getManagerById(managerId)?.name ?? managerId;
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
    case 'topLeagues':
      return `Played in ${c.count}+ top-5 leagues`;
    case 'leagueTitle':
      return `${LEAGUE_LABELS[c.league] ?? c.league} winner`;
    case 'treble':
      return 'Treble winner';
    case 'bornDecade':
      return `Born in the ${c.decade}s`;
    case 'oneClub':
      return 'One-club player';
    case 'honourYear':
      return `${HONOUR_LABELS[c.honour]} ${c.year}`;
    case 'playedInCountry':
      return `Played in ${c.country}`;
    case 'continent':
      return c.continent;
    case 'managedBy':
      return `Played under ${managerName(c.managerId)}`;
  }
}

/**
 * The bare value noun for a criterion — the blank in "Has played for ___" /
 * "Has won the ___". Used by the in-game legend to explain each cell of the
 * current grid in plain language (see `legend.meaning.*`). Positions are
 * lowercased so they read naturally mid-sentence ("plays as a defender").
 */
export function criterionValue(c: Criterion): string {
  switch (c.kind) {
    case 'nationality':
      return c.country;
    case 'club':
      return getClub(c.clubId)?.name ?? c.clubId;
    case 'honour':
      return HONOUR_LABELS[c.honour];
    case 'teammate':
      return teammateName(c.playerId);
    case 'league':
      return LEAGUE_LABELS[c.league] ?? c.league;
    case 'position':
      return POSITION_LABELS[c.position].toLowerCase();
    case 'shirtNumber':
      return String(c.number);
    case 'topLeagues':
      return String(c.count);
    case 'tag':
      return TAG_LABELS[c.tag] ?? c.tag;
    case 'leagueTitle':
      return LEAGUE_LABELS[c.league] ?? c.league;
    case 'treble':
      return 'treble';
    case 'bornDecade':
      return `${c.decade}s`;
    case 'oneClub':
      return 'one club';
    case 'honourYear':
      return `${HONOUR_LABELS[c.honour]} (${c.year})`;
    case 'playedInCountry':
      return c.country;
    case 'continent':
      return c.continent;
    case 'managedBy':
      return managerName(c.managerId);
  }
}

/** Compact code (MUN, ESP, UCL, …) for the tiny grid axis chips. */
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
      // The portrait already identifies the player; the box just needs the axis
      // kind. "Teammate" is shorter than "Played with", so it always fits.
      return 'Teammate';
    case 'topLeagues':
      return `${c.count}+ Top5`;
    case 'leagueTitle':
      return LEAGUE_SHORT[c.league] ?? LEAGUE_LABELS[c.league] ?? c.league;
    case 'treble':
      return 'Treble';
    case 'bornDecade':
      return `${String(c.decade).slice(2)}s`;
    case 'oneClub':
      return '1 club';
    case 'honourYear':
      return `${HONOUR_SHORT[c.honour] ?? HONOUR_LABELS[c.honour]} ${c.year}`;
    case 'playedInCountry':
      return NATION_SHORT[c.country] ?? c.country;
    case 'continent':
      return c.continent;
    case 'managedBy':
      return managerName(c.managerId);
  }
}

function sameCriterion(a: Criterion, b: Criterion): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Minimum footballers a criterion needs to be a usable axis. */
const MIN_AXIS = 4;

/**
 * Clubs need a deeper pool than other axes: a club with a handful of players
 * (e.g. Vancouver via a single star's MLS spell) makes near-unguessable cells,
 * so career-history clubs only become axes once they have real depth. The
 * same goes for nations — lineup-driven data batches can push a small
 * footballing nation past MIN_AXIS purely on retired squad players, and a
 * four-deep nation column is brutal to guess.
 */
const MIN_CLUB_AXIS = 6;
const MIN_NATION_AXIS = 6;

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
  // High-connectivity modern hubs (many in-dataset teammates → varied grids).
  'Lewandowski, Robert', 'Cancelo, João', 'Lukaku, Romelu', 'Kovačić, Mateo',
  'Sterling, Raheem', 'Di María, Ángel', 'Félix, João', 'Gündoğan, İlkay',
  'Aubameyang, Pierre-Emerick', 'Courtois, Thibaut', 'Sánchez, Alexis',
  'Silva, Thiago', 'Fàbregas, Cesc', 'Pogba, Paul', 'Hakimi, Achraf',
  'Rüdiger, Antonio', 'Walker, Kyle',
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
  // Honours for spice — trophies plus cup winners. The generic 'league-title'
  // axis is replaced by the per-league winner axes below.
  (
    [
      'champions-league', 'world-cup', 'ballon-dor', 'golden-boot',
      'european-championship', 'copa-america', 'europa-league',
      'domestic-cup',
    ] as const
  ).forEach(honour => criteria.push({kind: 'honour', honour}));
  // Per-league titles (only leagues with bundled trophy art) + the treble.
  (['premier-league', 'la-liga', 'serie-a', 'bundesliga'] as const).forEach(
    league => criteria.push({kind: 'leagueTitle', league}),
  );
  criteria.push({kind: 'treble'});
  // Iconic shirt numbers.
  AXIS_SHIRT_NUMBERS.forEach(number =>
    criteria.push({kind: 'shirtNumber', number}),
  );
  // "Played with X" — only for hub players that exist in the dataset AND have
  // a portrait illustration; hubs without art wait until their sheet lands.
  AXIS_TEAMMATES.filter(
    id => getById(id) && PLAYER_AVATARS[id] != null,
  ).forEach(playerId => criteria.push({kind: 'teammate', playerId}));
  // The "played in 3+ top-5 leagues" axis is benched — playtesting found it
  // too hard. Re-add `criteria.push({kind: 'topLeagues', count: 3})` if a
  // gentler variant (count: 2?) ever earns its place.

  return criteria
    .map(c => ({
      c,
      ids: new Set(FOOTBALLERS.filter(f => matches(f, c)).map(f => f.id)),
    }))
    .filter(
      cand =>
        cand.ids.size >=
        (cand.c.kind === 'club'
          ? MIN_CLUB_AXIS
          : cand.c.kind === 'nationality'
            ? MIN_NATION_AXIS
            : MIN_AXIS),
    );
}

/**
 * The candidate catalog, built once and reused — scanning all footballers
 * against every criterion is the expensive part of grid generation, and it
 * only changes when the dataset does (OTA hydrate bumps the generation, so
 * the memo rebuilds on first use after new data lands). The search below
 * never mutates the shared candidates: `shuffle` copies and the id sets are
 * read-only.
 */
export const candidatePool = derivedFromData(buildCandidates);

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
 * True iff every cell can be assigned `demand` footballers with no footballer
 * assigned to more than one cell. Per-cell counts alone aren't enough: a game
 * never lets a footballer be reused, so a player who is the answer to several
 * cells only actually covers one of them. Kuhn's augmenting-path matching over
 * cell-slots (each cell repeated `demand` times) vs footballer ids.
 */
export function hasDisjointAssignment(
  cellIds: readonly (readonly string[])[],
  demand: number,
): boolean {
  const owner = new Map<string, number>(); // footballer id -> slot
  const augment = (slot: number, seen: Set<string>): boolean => {
    for (const id of cellIds[Math.floor(slot / demand)]) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const current = owner.get(id);
      if (current === undefined || augment(current, seen)) {
        owner.set(id, slot);
        return true;
      }
    }
    return false;
  };
  for (let slot = 0; slot < cellIds.length * demand; slot++) {
    if (!augment(slot, new Set())) {
      return false;
    }
  }
  return true;
}

/**
 * Order-independent fingerprint of a grid's axes (rows/cols swap and any
 * within-axis reorder produce the same signature, since they yield the same
 * puzzle). Used to avoid repeating a recent grid.
 */
export function gridSignature(g: Grid): string {
  const rows = g.rows.map(c => JSON.stringify(c)).sort().join('|');
  const cols = g.cols.map(c => JSON.stringify(c)).sort().join('|');
  return rows < cols ? `${rows}//${cols}` : `${cols}//${rows}`;
}

/**
 * Max cells a single footballer may be a valid answer for, across the 9-cell
 * grid. Stops "every box fits Zlatan" boards where one superstar solves most of
 * the grid — those feel repetitive and trivial.
 */
const MAX_SUPERSTAR_CELLS = 4;

/** Largest number of cells any single player satisfies on a candidate grid. */
function peakPlayerCoverage(rows: Candidate[], cols: Candidate[]): number {
  const perPlayer = new Map<string, number>();
  let peak = 0;
  for (const r of rows) {
    for (const c of cols) {
      // Players valid for this cell = row.ids ∩ col.ids.
      const [small, big] = r.ids.size < c.ids.size ? [r.ids, c.ids] : [c.ids, r.ids];
      small.forEach(id => {
        if (big.has(id)) {
          const n = (perPlayer.get(id) ?? 0) + 1;
          perPlayer.set(id, n);
          if (n > peak) {
            peak = n;
          }
        }
      });
    }
  }
  return peak;
}

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
  topLeagues: 1,
  leagueTitle: 1,
  treble: 1,
};

/**
 * How hard the BOARD is, as opposed to how well the opponent plays it (that is
 * `BOT_TIERS` in bot.ts — the two are siblings and should be read together).
 * Picking "easy" used to hand a beginner a full-strength grid and merely a
 * dumber bot; these tiers make the puzzle itself gentler:
 *
 * - `minPerLadder` — required distinct answers per cell, tried in order. More
 *   answers per cell = more ways to be right.
 * - `kinds` — restricts which axis kinds may appear. Easy sticks to the axes a
 *   casual fan can actually reason about (clubs, nations, headline honours) and
 *   never draws "Played with Cancelo", a shirt number or a treble.
 * - `cellStar` — every cell must hold at least one answer this famous. This is
 *   the lever that matters most: four players nobody has heard of is not an
 *   easy cell just because it is four.
 *
 * `hard` reproduces the historical behaviour exactly, and an absent tier
 * resolves to `hard`, so online, ranked and pass-and-play are untouched.
 */
export type BoardTier = 'easy' | 'medium' | 'hard';

type TierSpec = {
  minPerLadder: readonly number[];
  kinds: ReadonlySet<Criterion['kind']> | null;
  cellStar: number | null;
};

const BOARD_TIERS: Record<BoardTier, TierSpec> = {
  easy: {
    minPerLadder: [4, 3, 2],
    kinds: new Set<Criterion['kind']>(['club', 'nationality', 'honour']),
    cellStar: 20,
  },
  medium: {minPerLadder: [3, 2], kinds: null, cellStar: 12},
  hard: {minPerLadder: [2, 1], kinds: null, cellStar: null},
};

/**
 * famePrior for every footballer, computed once per dataset generation. The
 * search below asks about fame on every grid that clears the disjoint-assignment
 * check, and famePrior walks a player's whole honour/club history each call.
 */
const famePriorById = derivedFromData(() => {
  const byId = new Map<string, number>();
  for (const f of FOOTBALLERS) {
    byId.set(f.id, famePrior(f));
  }
  return byId;
});

export function generateGrid(
  rng: Rng = Math.random,
  opts: {avoid?: readonly string[]; difficulty?: BoardTier} = {},
): Grid {
  const tier = BOARD_TIERS[opts.difficulty ?? 'hard'];
  const fame = famePriorById();
  const pool = tier.kinds
    ? candidatePool().filter(cand => tier.kinds!.has(cand.c.kind))
    : candidatePool();
  const avoid = new Set(opts.avoid ?? []);

  /** Does every cell hold at least one answer famous enough for this tier? */
  const everyCellHasAStar = (cellIds: string[][]): boolean =>
    tier.cellStar === null ||
    cellIds.every(ids => ids.some(id => (fame.get(id) ?? 0) >= tier.cellStar!));

  const attempt = (minPer: number): Grid | null => {
    // Remember the first solvable grid so we never fail even if none clears the
    // superstar-coverage guard / recent-grid avoidance within the budget.
    let fallback: Grid | null = null;
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
        // Per-cell counts (checked above) are necessary but not sufficient:
        // the same footballer may be counted for several cells, yet he can
        // only ever be played once. Require a fully disjoint assignment of
        // minPer distinct footballers per cell (row-major, as in the engine).
        const cellIds: string[][] = [];
        for (const r of rows) {
          for (const c of cols) {
            const [small, big] =
              r.ids.size < c.ids.size ? [r.ids, c.ids] : [c.ids, r.ids];
            cellIds.push([...small].filter(id => big.has(id)));
          }
        }
        if (!hasDisjointAssignment(cellIds, minPer)) {
          continue;
        }
        // Gentler tiers additionally demand a recognisable name in every cell.
        if (!everyCellHasAStar(cellIds)) {
          continue;
        }
        const candidate = {rows: rows.map(r => r.c), cols: cols.map(c => c.c)};
        const fresh = !avoid.has(gridSignature(candidate));
        if (fresh && peakPlayerCoverage(rows, cols) <= MAX_SUPERSTAR_CELLS) {
          return candidate;
        }
        // Prefer a fresh (non-repeated) grid as the fallback when possible.
        if (!fallback || fresh) {
          fallback = candidate;
        }
      }
    }
    return fallback;
  };

  for (const minPer of tier.minPerLadder) {
    const grid = attempt(minPer);
    if (grid) {
      return grid;
    }
  }
  // A gentle tier's constraints (famous answer in all 9 cells, from a third of
  // the axis pool) can genuinely be unsatisfiable within the shuffle budget on
  // some datasets. Degrading to a normal board beats failing the match.
  if (opts.difficulty && opts.difficulty !== 'hard') {
    return generateGrid(rng, {avoid: opts.avoid});
  }
  throw new Error('Could not generate a solvable hattrick grid');
}
