/**
 * Iconic starting XIs, curated by hand from match reports (Wikipedia final
 * pages) the same way footballers.ts is maintained. The entries live in
 * ./lineups/, grouped by competition; this module owns the types, the
 * aggregated array (whose identity the OTA store mutates in place) and the
 * Team sheet helpers.
 *
 * Lineups are self-contained — many of these players (Schmeichel, Maldini,
 * Pelé…) predate the modern footballers.ts roster, so names and `aliases` live
 * here rather than depending on that file. `footballerId` links to a Footballer
 * only where one exists. Positions use the coarse GK/DF/MF/FW buckets; the
 * `formation` string keeps the real shape for display, and the players array
 * is ordered GK first, then formation rows top to bottom (each row roughly
 * right to left, like a printed team sheet).
 *
 * The Team sheet fields (`match`, `shirt`, `goals`, `assists`, `captain`) are
 * optional so older entries and OTA packs stay valid; a lineup only enters the
 * daily pool once fully enriched (see `isTeamsheetLineup`).
 */
import type {Position} from './types';
import {CLASSICS} from './lineups/classics';
import {COPA_AND_OTHERS} from './lineups/copaAndOthers';
import {EURO_FINALS} from './lineups/euroFinals';
import {UCL_FINALS} from './lineups/uclFinals';
import {WC_FINALS} from './lineups/wcFinals';

export type LineupPlayer = {
  /** Name shown on the pitch. */
  name: string;
  position: Position;
  /** Link to footballers.ts where the player exists there. */
  footballerId?: string;
  /**
   * Extra accepted answers (alternate spellings, nicknames, distinguishing
   * names when two players share a surname). Human-readable — the engine
   * folds them. The folded full name, and the bare surname when it is unique
   * within the XI, are accepted automatically.
   */
  aliases?: string[];
  /** Shirt number worn in this match. Required for Team sheet eligibility. */
  shirt?: number;
  /** Goals scored in this match. Own goals are NOT counted (and get no icon). */
  goals?: number;
  /** Assists in this match — only recorded where the historical record is solid. */
  assists?: number;
  /** Wore the armband at kick-off. Exactly one per Team sheet lineup. */
  captain?: boolean;
  /** Was substituted off during the match (swap-arrows badge). Optional and
   * curated best-effort; absent just means no badge. */
  subbedOff?: boolean;
  /** Booked in this match (yellow-card badge). Same best-effort policy as
   * `subbedOff`: absence means "no card or unknown", never a fact. */
  yellowCard?: boolean;
  /** Sent off in this match (red-card badge). A second yellow is recorded as
   * `redCard` only — the dismissal is the fact worth showing. */
  redCard?: boolean;
};

/**
 * The known competition keys — each has a `teamsheet.competitions.<key>`
 * string in en/da. Extend the list (and both i18n files) before using a new
 * one; the data tests enforce membership.
 */
export const COMPETITION_KEYS = [
  'worldCupFinal',
  // Binaries without this key in their i18n fall back to the legacy
  // `competition` string, so it is safe to ship over the air.
  'worldCupThirdPlace',
  'euroFinal',
  'uclFinal',
  'europeanCupFinal',
  'europaFinal',
  'copaFinal',
  'cupFinal',
  'leagueMatch',
] as const;
export type CompetitionKey = (typeof COMPETITION_KEYS)[number];

/** Match context for Team sheet: who was beaten and by what score. */
export type FamousLineupMatch = {
  competitionKey: CompetitionKey;
  /** The other team, e.g. 'Croatia'. Raw proper noun, like `team`. */
  opponent: string;
  /** This team's goals, including extra time (and opponent own goals). */
  goalsFor: number;
  goalsAgainst: number;
  afterExtraTime?: boolean;
  /** Shootout score — both present or neither, and only when the game was level. */
  pensFor?: number;
  pensAgainst?: number;
  /** Opponent own goals inside `goalsFor`, so per-player goals still balance. */
  oppOwnGoals?: number;
};

/** The shirt this team actually wore that day, as flat colours (stripes and
 * checks are approximated by their dominant colour). Drives the Team sheet
 * token circles; entries without a kit fall back to the brand purple. */
export type LineupKit = {
  /** Outfield shirt colour, hex. */
  body: string;
  /** Number colour on that shirt, hex. */
  number: string;
  /** Keeper's shirt/number when known; a neutral dark is used otherwise. */
  gkBody?: string;
  gkNumber?: string;
};

export type FamousLineup = {
  id: string;
  team: string;
  /** Legacy display string; Team sheet renders `match.competitionKey` via i18n. */
  competition: string;
  year: number;
  formation: string;
  /** Exactly 11 players. */
  players: LineupPlayer[];
  /** Present (with full player enrichment) on Team sheet eligible entries. */
  match?: FamousLineupMatch;
  kit?: LineupKit;
};

export const FAMOUS_LINEUPS: readonly FamousLineup[] = [
  ...UCL_FINALS,
  ...WC_FINALS,
  ...EURO_FINALS,
  ...COPA_AND_OTHERS,
  ...CLASSICS,
];

/** Oldest match year allowed in the Team sheet daily pool — older XIs stay
 * in the data (and any future use) but never front a daily. */
export const TEAMSHEET_MIN_YEAR = 1990;

/**
 * A lineup qualifies for the Team sheet daily pool once its match context and
 * per-player enrichment are complete and it is modern enough. Shared by the
 * pool, the schedule build script and the data tests, so "eligible" means one
 * thing everywhere.
 */
export function isTeamsheetLineup(lineup: FamousLineup): boolean {
  return (
    lineup.year >= TEAMSHEET_MIN_YEAR &&
    lineup.match !== undefined &&
    lineup.players.length === 11 &&
    lineup.players.every(p => p.shirt !== undefined) &&
    lineup.players.filter(p => p.captain).length === 1
  );
}

/** Look up a lineup by id in the live (possibly OTA-hydrated) array. */
export function getLineupById(id: string): FamousLineup | undefined {
  return FAMOUS_LINEUPS.find(l => l.id === id);
}
