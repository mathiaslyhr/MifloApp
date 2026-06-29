/**
 * Curated footballer database (hand-maintained seed set), aggregated from the
 * batch modules under players/. Split by primary identity purely to keep diffs
 * reviewable — module membership has NO effect on queries: the repository
 * derives every category (leagues, honours, nationality, tags) from each
 * player's own data, so a player appears in every category they actually match.
 *
 * Reviewed for accuracy: club histories list the major senior clubs each player
 * actually played for (limited to clubs that exist in clubs.ts), and honours are
 * limited to ones that are easy to state exactly — Champions League, World Cup,
 * Ballon d'Or, European Championship. (Deliberately no league-title /
 * golden-boot counts, which are obscure and error-prone to maintain by hand.)
 * Years are approximate transfer years and only used as supporting data.
 *
 * Expand by editing/adding modules under players/ — the schema (types.ts) is the
 * stable part. Up to date as of mid-2026.
 */
import type {Footballer} from './types';
import {LEGENDS} from './players/legends';
import {PREMIER_LEAGUE} from './players/premier-league';
import {LA_LIGA} from './players/la-liga';
import {SERIE_A} from './players/serie-a';
import {BUNDESLIGA} from './players/bundesliga';
import {LIGUE_1} from './players/ligue-1';
import {WORLD_CUP} from './players/world-cup';

export const FOOTBALLERS: readonly Footballer[] = [
  ...LEGENDS,
  ...PREMIER_LEAGUE,
  ...LA_LIGA,
  ...SERIE_A,
  ...BUNDESLIGA,
  ...LIGUE_1,
  ...WORLD_CUP,
];
