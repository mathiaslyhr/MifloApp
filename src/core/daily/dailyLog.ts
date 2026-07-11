/**
 * The Log tab's one view of the daily games: every recorded day across Scout,
 * Top Bins, Journeyman and Team sheet merged into per-day rows, plus each
 * game's streak. Read-only over the games' own storage — the games keep
 * writing via their `recordHistory`, this module only aggregates.
 *
 * Deliberately separate from `core/notifications/dailyStatus.ts`: that is the
 * notification layer's today-only "finished?" view; this is the archive.
 */
import {previousDateKey} from '../../games/scout/dailySeed';
import {
  loadDailyProgress as loadJourneymanProgress,
  loadHistory as loadJourneymanHistory,
  loadStreak as loadJourneymanStreak,
} from '../../games/journeyman/storage';
import {
  loadDailyProgress as loadScoutProgress,
  loadHistory as loadScoutHistory,
  loadStreak as loadScoutStreak,
} from '../../games/scout/mysteryStorage';
import {
  loadDailyProgress as loadTeamsheetProgress,
  loadHistory as loadTeamsheetHistory,
  loadStreak as loadTeamsheetStreak,
} from '../../games/teamsheet/storage';
import {
  loadDailyProgress as loadTenballProgress,
  loadHistory as loadTenballHistory,
  loadStreak as loadTenballStreak,
} from '../../games/tenball/storage';
import type {HistoryLog as JourneymanHistory} from '../../games/journeyman/types';
import type {HistoryLog as ScoutHistory, StreakState} from '../../games/scout/types';
import type {HistoryLog as TeamsheetHistory} from '../../games/teamsheet/types';
import type {HistoryLog as TenballHistory} from '../../games/tenball/types';

/** Hub display order — the log's chips follow it. */
export const DAILY_GAMES = ['scout', 'tenball', 'journeyman', 'teamsheet'] as const;
export type DailyGame = (typeof DAILY_GAMES)[number];

/**
 * `'won'`/`'revealed'` = the day is finished (the social feed publishes that
 * distinction; the Log tab renders both as done). `'revealed'` also covers
 * Scout's legacy `'lost'` entries. `'ongoing'` = started but not finished;
 * only today can be ongoing, since progress never survives past its own day.
 */
export type DayCellStatus = 'won' | 'revealed' | 'ongoing' | 'notPlayed';

export type DayCell = {
  status: DayCellStatus;
  /**
   * The tries metric: guesses used (Scout/Journeyman) or misses (Top
   * Bins/Team sheet). The running count while ongoing; null when not played.
   */
  count: number | null;
  /**
   * The finished day's list/lineup id (Top Bins/Team sheet only) — lets the
   * owner's UI resolve the list or team title locally. Never published.
   */
  refId?: string;
};

export type DailyLogDay = {
  dateKey: string;
  cells: Record<DailyGame, DayCell>;
};

export type DailyLog = {
  /** Reverse chronological, today first. */
  days: DailyLogDay[];
  streaks: Record<DailyGame, {current: number; best: number}>;
};

export type DailyHistories = {
  scout: ScoutHistory;
  tenball: TenballHistory;
  journeyman: JourneymanHistory;
  teamsheet: TeamsheetHistory;
};

/** The log never reaches further back than this many days. */
const MAX_DAYS = 30;

const NOT_PLAYED: DayCell = {status: 'notPlayed', count: null};

/** Tries so far per started-but-unfinished game; null = not started. */
export type OngoingTries = Record<DailyGame, number | null>;

const NO_STARTS: OngoingTries = {
  scout: null,
  tenball: null,
  journeyman: null,
  teamsheet: null,
};

function openCell(tries: number | null): DayCell {
  return tries === null ? NOT_PLAYED : {status: 'ongoing', count: tries};
}

function cellsFor(
  dateKey: string,
  histories: DailyHistories,
  started: OngoingTries,
): Record<DailyGame, DayCell> {
  const scout = histories.scout[dateKey];
  const tenball = histories.tenball[dateKey];
  const journeyman = histories.journeyman[dateKey];
  const teamsheet = histories.teamsheet[dateKey];
  return {
    scout: scout
      ? {status: scout.status === 'won' ? 'won' : 'revealed', count: scout.guessCount}
      : openCell(started.scout),
    tenball: tenball
      ? {status: tenball.status, count: tenball.misses, refId: tenball.listId}
      : openCell(started.tenball),
    journeyman: journeyman
      ? {status: journeyman.status, count: journeyman.guessCount}
      : openCell(started.journeyman),
    teamsheet: teamsheet
      ? {status: teamsheet.status, count: teamsheet.misses, refId: teamsheet.lineupId}
      : openCell(started.teamsheet),
  };
}

/**
 * Pure merge: today first, then walk back day by day to the earliest recorded
 * entry in any game (gap days included as notPlayed), capped at `MAX_DAYS`.
 * With no history at all the log is just today's row. `startedToday` carries
 * the tries so far for games with saved progress but no finished result yet —
 * today's ongoing chips.
 */
export function buildDailyLog(
  todayKey: string,
  histories: DailyHistories,
  streaks: Record<DailyGame, StreakState>,
  startedToday: OngoingTries = NO_STARTS,
): DailyLog {
  // `YYYY-MM-DD` sorts lexicographically, so string-min finds the oldest day.
  let earliest: string | undefined;
  for (const game of DAILY_GAMES) {
    for (const dateKey of Object.keys(histories[game])) {
      if (earliest === undefined || dateKey < earliest) {
        earliest = dateKey;
      }
    }
  }

  const days: DailyLogDay[] = [];
  let key = todayKey;
  for (let i = 0; i < MAX_DAYS; i++) {
    days.push({
      dateKey: key,
      cells: cellsFor(key, histories, key === todayKey ? startedToday : NO_STARTS),
    });
    if (earliest === undefined || key <= earliest) {
      break;
    }
    key = previousDateKey(key);
  }

  return {
    days,
    streaks: {
      scout: {current: streaks.scout.current, best: streaks.scout.best},
      tenball: {current: streaks.tenball.current, best: streaks.tenball.best},
      journeyman: {current: streaks.journeyman.current, best: streaks.journeyman.best},
      teamsheet: {current: streaks.teamsheet.current, best: streaks.teamsheet.best},
    },
  };
}

/** Loads all four games' histories, streaks and today's progress, and merges. */
export async function loadDailyLog(todayKey: string): Promise<DailyLog> {
  const [
    scout,
    tenball,
    journeyman,
    teamsheet,
    scoutStreak,
    tenballStreak,
    journeymanStreak,
    teamsheetStreak,
    scoutProgress,
    tenballProgress,
    journeymanProgress,
    teamsheetProgress,
  ] = await Promise.all([
    loadScoutHistory(),
    loadTenballHistory(),
    loadJourneymanHistory(),
    loadTeamsheetHistory(),
    loadScoutStreak(),
    loadTenballStreak(),
    loadJourneymanStreak(),
    loadTeamsheetStreak(),
    loadScoutProgress(todayKey),
    loadTenballProgress(todayKey),
    loadJourneymanProgress(todayKey),
    loadTeamsheetProgress(todayKey),
  ]);
  return buildDailyLog(
    todayKey,
    {scout, tenball, journeyman, teamsheet},
    {
      scout: scoutStreak,
      tenball: tenballStreak,
      journeyman: journeymanStreak,
      teamsheet: teamsheetStreak,
    },
    // "Started" is just saved progress; a finished game also has a history
    // entry for today, and the history check wins in cellsFor. The counts
    // mirror the engines exactly because no-op guesses are never persisted:
    // stored tenball guesses without a rank / teamsheet guesses without a
    // slot are precisely the engines' misses.
    {
      scout: scoutProgress ? scoutProgress.guessedIds.length : null,
      tenball: tenballProgress
        ? tenballProgress.guesses.filter(g => g.rank === undefined).length
        : null,
      journeyman: journeymanProgress ? journeymanProgress.guessedIds.length : null,
      teamsheet: teamsheetProgress
        ? teamsheetProgress.guesses.filter(g => g.slot === undefined).length
        : null,
    },
  );
}
