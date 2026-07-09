/**
 * OTA content store. hydrate() applies a downloaded content pack by mutating
 * the exported bundled arrays/objects IN PLACE — references never change, so
 * every import site (games read FOOTBALLERS/CLUBS/DAILY_SECRETS at call time)
 * stays correct with zero changes. Module-level derived structures rebuild
 * lazily through the generation counter (see generation.ts).
 *
 * Sections missing from a pack keep the current data, so future games can add
 * sections without breaking older payloads. Packs always come from freshly
 * parsed JSON (or bundledSnapshot()), so hydrate never receives objects that
 * are already referenced elsewhere.
 *
 * Question TEXT for redCardQuestions travels as i18n strings in the pack; the
 * sync layer merges those into i18next (this store only owns the id pool).
 */
import {CLUBS} from './clubs';
import {FAMOUS_LINEUPS, type FamousLineup} from './famousLineups';
import {FOOTBALLERS} from './footballers';
import {bumpGeneration} from './generation';
import {MANAGERS} from './managers';
import {TREBLE_SQUADS, TREBLE_WINNER_IDS, type TrebleSquad} from './trebles';
import type {Club, Footballer, Manager} from './types';
import {QUESTION_POOL} from '../../games/red-card/questions';
import {DAILY_SECRETS} from '../../games/scout/schedule.generated';

export type ContentPack = {
  footballers?: Footballer[];
  clubs?: Club[];
  managers?: Manager[];
  trebleSquads?: TrebleSquad[];
  famousLineups?: FamousLineup[];
  scoutSchedule?: {dailySecrets: Record<string, string>; poolSignature?: number};
  redCardQuestions?: {ids: string[]; i18n?: Record<string, object>};
};

function replaceArray<T>(target: readonly T[], next: readonly T[]): void {
  const arr = target as T[];
  arr.length = 0;
  arr.push(...next);
}

/** The bundled data as shipped in this binary, captured before any hydrate. */
const BUNDLED: Required<Omit<ContentPack, 'redCardQuestions'>> &
  Pick<ContentPack, 'redCardQuestions'> = {
  footballers: [...FOOTBALLERS],
  clubs: [...CLUBS],
  managers: [...MANAGERS],
  trebleSquads: [...TREBLE_SQUADS],
  famousLineups: [...FAMOUS_LINEUPS],
  scoutSchedule: {dailySecrets: {...DAILY_SECRETS}},
  redCardQuestions: {ids: [...QUESTION_POOL]},
};

/** A fresh pack of the bundled data — hydrate(bundledSnapshot()) restores it. */
export function bundledSnapshot(): ContentPack {
  return {
    footballers: [...BUNDLED.footballers],
    clubs: [...BUNDLED.clubs],
    managers: [...BUNDLED.managers],
    trebleSquads: [...BUNDLED.trebleSquads],
    famousLineups: [...BUNDLED.famousLineups],
    scoutSchedule: {dailySecrets: {...BUNDLED.scoutSchedule.dailySecrets}},
    redCardQuestions: {ids: [...BUNDLED.redCardQuestions!.ids]},
  };
}

/** Apply a content pack in place and invalidate dataset-derived memos. */
export function hydrate(pack: ContentPack): void {
  if (pack.footballers) {
    replaceArray(FOOTBALLERS, pack.footballers);
  }
  if (pack.clubs) {
    replaceArray(CLUBS, pack.clubs);
  }
  if (pack.managers) {
    replaceArray(MANAGERS, pack.managers);
  }
  if (pack.trebleSquads) {
    replaceArray(TREBLE_SQUADS, pack.trebleSquads);
    const winners = TREBLE_WINNER_IDS as Set<string>;
    winners.clear();
    for (const squad of TREBLE_SQUADS) {
      for (const id of squad.playerIds) {
        winners.add(id);
      }
    }
  }
  if (pack.famousLineups) {
    replaceArray(FAMOUS_LINEUPS, pack.famousLineups);
  }
  if (pack.scoutSchedule) {
    for (const key of Object.keys(DAILY_SECRETS)) {
      delete DAILY_SECRETS[key];
    }
    Object.assign(DAILY_SECRETS, pack.scoutSchedule.dailySecrets);
  }
  if (pack.redCardQuestions) {
    replaceArray(QUESTION_POOL, pack.redCardQuestions.ids);
  }
  bumpGeneration();
}

export {derivedFromData, generation} from './generation';
