/**
 * The notification layer's one view of the daily games: what counts as
 * "started" and "finished" today for each of Scout, Top Bins, Journeyman and
 * Team sheet, plus each game's streak. `nudgePlan` decides the day's nudges
 * from exactly this, so the rules live in one place and cannot disagree with
 * themselves. A new daily game only has to add its entry to
 * `loadDailyStatuses`.
 *
 * Finished includes a surrender: there is nothing left to nudge someone about.
 * Started deliberately means a real guess, not an opened screen, because the
 * evening taunt ("was it that hard?") is a bluff against someone who never
 * actually tried.
 */
import type {DailyGame} from '../daily/dailyLog';
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
  game: DailyGame;
  /** At least one real guess today. */
  startedToday: boolean;
  /** Solved or surrendered today. */
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
      startedToday: (scout?.guessedIds.length ?? 0) > 0,
      finishedToday:
        scout != null &&
        (scout.gaveUp === true ||
          (scout.secretId != null && scout.guessedIds.includes(scout.secretId))),
      streakDays: scoutStreak.current,
      streakLastCompleted: scoutStreak.lastCompletedDateKey,
    },
    {
      game: 'tenball',
      startedToday: (tenball?.guesses.length ?? 0) > 0,
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
      startedToday: (journeyman?.guessedIds.length ?? 0) > 0,
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
      startedToday: (teamsheet?.guesses.length ?? 0) > 0,
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
