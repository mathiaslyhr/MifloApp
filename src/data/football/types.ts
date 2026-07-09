/**
 * Shared football fact layer — the curated "database" every game queries.
 *
 * This is intentionally decoupled from any single game: games never touch the
 * raw arrays, they go through the repository's `Criterion`-based query API
 * (see repository.ts). That keeps the data model rich enough to drive both
 * predefined quiz questions and intersection-style games (e.g. footy
 * hattrick: "played for BOTH X AND Y") without per-game forks.
 */

/** Coarse positions for now; can be refined (ST/CB/...) later without churn. */
export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export type HonourType =
  | 'champions-league'
  | 'europa-league'
  | 'world-cup'
  | 'european-championship'
  | 'league-title'
  | 'domestic-cup'
  | 'ballon-dor'
  | 'golden-boot'
  | 'copa-america'
  | 'player-of-the-season';

/** Human-readable labels for honours, used when generating quiz copy. */
export const HONOUR_LABELS: Record<HonourType, string> = {
  'champions-league': 'Champions League',
  'europa-league': 'Europa League',
  'world-cup': 'World Cup',
  'european-championship': 'European Championship',
  'league-title': 'league title',
  'domestic-cup': 'domestic cup',
  'ballon-dor': 'Ballon d\'Or',
  'golden-boot': 'Golden Boot',
  'copa-america': 'Copa América',
  'player-of-the-season': 'Player of the Season',
};

/** Plural noun phrases for "How many X has … won?" style copy. */
export const HONOUR_COUNT_LABELS: Record<HonourType, string> = {
  'champions-league': 'Champions League titles',
  'europa-league': 'Europa League titles',
  'world-cup': 'World Cups',
  'european-championship': 'European Championships',
  'league-title': 'league titles',
  'domestic-cup': 'domestic cups',
  'ballon-dor': 'Ballon d\'Or awards',
  'golden-boot': 'Golden Boots',
  'copa-america': 'Copa América titles',
  'player-of-the-season': 'Player of the Season awards',
};

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'Goalkeeper',
  DF: 'Defender',
  MF: 'Midfielder',
  FW: 'Forward',
};

/** Reference entity. `league` matches quiz topic ids ('premier-league', ...). */
export type Club = {
  id: string;
  name: string;
  country: string;
  league: string;
};

export type ClubSpell = {
  clubId: string;
  /** First year at the club. */
  from?: number;
  /** Last year; undefined means current. */
  to?: number;
  loan?: boolean;
  appearances?: number;
  goals?: number;
};

export type Honour = {
  type: HonourType;
  count?: number;
  years?: number[];
  /** Set for club honours (league title, domestic cup, ...). */
  clubId?: string;
};

/**
 * A single notable season's output for a player — the basis for "hard" stat
 * trivia ("how many league goals did X score in 2024-25?"). Curated per player
 * for standout seasons only; most players have none. `clubId` must reference a
 * real club; `competition` is the human label used in question copy.
 */
export type SeasonStat = {
  /** Season label as written in copy, e.g. "2024-25". */
  season: string;
  clubId: string;
  /** e.g. "Premier League" — defaults to "league" in copy if omitted. */
  competition?: string;
  appearances?: number;
  goals?: number;
  assists?: number;
};

export type Footballer = {
  id: string;
  name: string;
  fullName?: string;
  /** Well-known nicknames/aliases used to boost player search (e.g. 'R9'). */
  nicknames?: string[];
  /** Can hold dual nationality. */
  nationality: string[];
  positions: Position[];
  /** Date of birth, `YYYY-MM-DD`. Drives the Age column in Scout. */
  born: string;
  shirtNumbers?: number[];
  clubs: ClubSpell[];
  honours: Honour[];
  /** Standout single-season stat lines; drives "Stats" quiz questions. */
  seasonStats?: SeasonStat[];
  /** Facts that can't be derived, e.g. 'legends', 'current-stars'. */
  tags?: string[];
};

/**
 * One managerial job. Exactly one of `clubId` / `country` is set: a club job
 * references clubs.ts, a national-team job the country name as used in
 * player nationalities. Open-ended (`to` omitted) = still in charge.
 */
export type ManagerSpell = {
  clubId?: string;
  country?: string;
  from: number;
  to?: number;
};

/**
 * A manager/head coach — groundwork for a future "Managed by X" axis
 * (match = player's club spell overlaps the manager's spell at that club).
 * Same id convention as Footballer: "Surname, First", single-name ids for
 * managers known by one name ('Luis Enrique').
 */
export type Manager = {
  id: string;
  name: string;
  nationality: string[];
  spells: ManagerSpell[];
};

/**
 * A single queryable fact. Games compose these: a quiz category is one
 * criterion, a hattrick cell is the AND of two. New game types add new
 * `kind`s here and a matching branch in `matches()`.
 */
export type Criterion =
  | {kind: 'club'; clubId: string}
  | {kind: 'league'; league: string}
  | {kind: 'nationality'; country: string}
  | {kind: 'position'; position: Position}
  | {kind: 'honour'; honour: HonourType}
  | {kind: 'tag'; tag: string}
  | {kind: 'shirtNumber'; number: number}
  | {kind: 'teammate'; playerId: string}
  /** Played in at least `count` of the top-5 European leagues. */
  | {kind: 'topLeagues'; count: number}
  /**
   * Won the title of a SPECIFIC league — derived: a league-title honour year
   * that overlaps a club spell in that league (no per-club title data needed).
   */
  | {kind: 'leagueTitle'; league: string}
  /** Continental treble winner — curated squads in trebles.ts. */
  | {kind: 'treble'};
