/**
 * This device's own daily results in the published (normalized) shape — the
 * source for both the Friends tab's "You" card and the one-time backfill, so
 * what you see of yourself is exactly what friends see of you. Read-only over
 * the games' history logs.
 */
import {loadHistory as loadJourneymanHistory, loadStreak as loadJourneymanStreak} from '../../games/journeyman/storage';
import {loadHistory as loadScoutHistory, loadStreak as loadScoutStreak} from '../../games/scout/mysteryStorage';
import {loadHistory as loadTeamsheetHistory, loadStreak as loadTeamsheetStreak} from '../../games/teamsheet/storage';
import {loadHistory as loadTenballHistory, loadStreak as loadTenballStreak} from '../../games/tenball/storage';
import {
  fromJourneymanEntry,
  fromScoutEntry,
  fromTeamsheetEntry,
  fromTenballEntry,
} from './normalize';
import type {PublishedResult} from './types';

export type MyRecentResults = {
  /** Finished days in [fromDateKey, todayKey], all four games merged. */
  results: PublishedResult[];
  /** The best current streak across the four games. */
  bestStreak: number;
};

/**
 * Every recorded day in the window, normalized. Streaks ride only on each
 * game's `lastCompletedDateKey` entry (the one row the UI reads them from);
 * other rows carry 0.
 */
export async function collectMyResults(
  fromDateKey: string,
  todayKey: string,
): Promise<MyRecentResults> {
  const [scout, tenball, journeyman, teamsheet, scoutStreak, tenballStreak, journeymanStreak, teamsheetStreak] =
    await Promise.all([
      loadScoutHistory(),
      loadTenballHistory(),
      loadJourneymanHistory(),
      loadTeamsheetHistory(),
      loadScoutStreak(),
      loadTenballStreak(),
      loadJourneymanStreak(),
      loadTeamsheetStreak(),
    ]);

  const results: PublishedResult[] = [];
  const push = (result: PublishedResult) => {
    if (result.dateKey >= fromDateKey && result.dateKey <= todayKey) {
      results.push(result);
    }
  };
  const streakFor = (
    dateKey: string,
    streak: {current: number; lastCompletedDateKey: string | null},
  ) => (dateKey === streak.lastCompletedDateKey ? streak.current : 0);

  for (const entry of Object.values(scout)) {
    push(fromScoutEntry(entry, streakFor(entry.dateKey, scoutStreak)));
  }
  for (const entry of Object.values(tenball)) {
    push(fromTenballEntry(entry, streakFor(entry.dateKey, tenballStreak)));
  }
  for (const entry of Object.values(journeyman)) {
    push(fromJourneymanEntry(entry, streakFor(entry.dateKey, journeymanStreak)));
  }
  for (const entry of Object.values(teamsheet)) {
    push(fromTeamsheetEntry(entry, streakFor(entry.dateKey, teamsheetStreak)));
  }

  const bestStreak = Math.max(
    scoutStreak.current,
    tenballStreak.current,
    journeymanStreak.current,
    teamsheetStreak.current,
    0,
  );
  return {results, bestStreak};
}
