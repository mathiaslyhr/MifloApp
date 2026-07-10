/**
 * The notification layer's one view of the daily games: what counts as
 * "finished today" for each of Scout, Top Bins, Journeyman and Team sheet,
 * plus each game's streak. Both the 09:00 reminder (skips mornings where
 * everything is done) and the 20:00 streak saver (which streaks are at risk
 * tonight) read from here, so the finished rules live in exactly one place.
 * A new daily game only has to add its entry to `loadDailyStatuses`.
 */
import {
  loadDailyProgress as loadJourneymanProgress,
  loadStreak as loadJourneymanStreak,
} from '../../games/journeyman/storage';
import {
  loadDailyProgress as loadScoutProgress,
  loadStreak as loadScoutStreak,
} from '../../games/scout/mysteryStorage';
import {
  loadDailyProgress as loadTeamsheetProgress,
  loadStreak as loadTeamsheetStreak,
} from '../../games/teamsheet/storage';
import {
  loadDailyProgress as loadTenballProgress,
  loadStreak as loadTenballStreak,
} from '../../games/tenball/storage';

export type DailyGameStatus = {
  /** i18n namespace holding the game's streakNotif copy. */
  game: 'scout' | 'tenball' | 'journeyman' | 'teamsheet';
  finishedToday: boolean;
  /** Days in the current streak (0 when there is none). */
  streakDays: number;
  /** `dateKey` of the last day the streak was extended, or null. */
  streakLastCompleted: string | null;
};

export async function loadDailyStatuses(
  today: string,
): Promise<DailyGameStatus[]> {
  const [
    scout,
    tenball,
    journeyman,
    teamsheet,
    scoutStreak,
    tenballStreak,
    journeymanStreak,
    teamsheetStreak,
  ] = await Promise.all([
    loadScoutProgress(today),
    loadTenballProgress(today),
    loadJourneymanProgress(today),
    loadTeamsheetProgress(today),
    loadScoutStreak(),
    loadTenballStreak(),
    loadJourneymanStreak(),
    loadTeamsheetStreak(),
  ]);
  return [
    {
      game: 'scout',
      finishedToday:
        scout?.secretId != null && scout.guessedIds.includes(scout.secretId),
      streakDays: scoutStreak.current,
      streakLastCompleted: scoutStreak.lastCompletedDateKey,
    },
    {
      game: 'tenball',
      finishedToday:
        tenball != null &&
        (tenball.gaveUp ||
          new Set(
            tenball.guesses.map(g => g.rank).filter(r => r !== undefined),
          ).size === 10),
      streakDays: tenballStreak.current,
      streakLastCompleted: tenballStreak.lastCompletedDateKey,
    },
    {
      game: 'journeyman',
      finishedToday:
        journeyman != null &&
        (journeyman.gaveUp ||
          (journeyman.secretId != null &&
            journeyman.guessedIds.includes(journeyman.secretId))),
      streakDays: journeymanStreak.current,
      streakLastCompleted: journeymanStreak.lastCompletedDateKey,
    },
    {
      game: 'teamsheet',
      finishedToday:
        teamsheet != null &&
        (teamsheet.gaveUp ||
          new Set(
            teamsheet.guesses.map(g => g.slot).filter(s => s !== undefined),
          ).size === 11),
      streakDays: teamsheetStreak.current,
      streakLastCompleted: teamsheetStreak.lastCompletedDateKey,
    },
  ];
}
