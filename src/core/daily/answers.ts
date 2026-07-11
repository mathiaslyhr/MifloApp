/**
 * Owner-only answer lookup for the daily archive: the player behind a Scout
 * or Journeyman day, the team behind a Team sheet day, the list behind a Top
 * Bins day. Resolved locally from the schedules and the finished day's own
 * ids — answers are never published, so friends can never see these.
 */
import type {TFunction} from 'i18next';
import {getLineupById} from '../../data/football';
import {dailySecretFor as journeymanSecretFor} from '../../games/journeyman/dailySeed';
import {dailySecretFor as scoutSecretFor} from '../../games/scout/dailySeed';
import type {DailyGame} from './dailyLog';

/**
 * The display answer for one FINISHED day of one game, or null when it can't
 * be resolved (a lineup/list that left the OTA data, an empty pool). Callers
 * must only ask for finished days — asking for today's unfinished puzzle
 * would spoil it for the owner.
 */
export function dailyAnswerFor(
  game: DailyGame,
  dateKey: string,
  refId: string | undefined,
  t: TFunction,
): string | null {
  try {
    switch (game) {
      case 'scout':
        return scoutSecretFor(dateKey).name;
      case 'journeyman':
        return journeymanSecretFor(dateKey).name;
      case 'tenball': {
        if (!refId) {
          return null;
        }
        // List titles are i18n strings shipped with the list (OTA pack model).
        const title = t(`tenball.lists.${refId}.title`, {defaultValue: ''});
        return title.length > 0 ? title : null;
      }
      case 'teamsheet': {
        const lineup = refId ? getLineupById(refId) : undefined;
        return lineup ? `${lineup.team} ${lineup.year}` : null;
      }
    }
  } catch {
    return null;
  }
}
