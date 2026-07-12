/**
 * Pure mappers from each daily game's own `HistoryEntry` to the normalized
 * `PublishedResult` the backend stores. Used at the games' finish points and
 * by the first-run backfill, so both paths publish identical rows. Read-only
 * over the games' types — no game storage changes here.
 *
 * The Log tab shows a right/wrong pair per day, so the wire carries both: the
 * wrong count in `score` (misses for Top Bins/Team sheet, the non-winning
 * guesses for Scout/Journeyman) and the right count in `total` (found slots, or
 * 1-on-a-win/0 for the guess-one-player games). Never the answer — no
 * published field can spoil a puzzle.
 */
import {previousDateKey} from '../../games/scout/dailySeed';
import type {DailyGame} from '../daily/dailyLog';
import type {HistoryEntry as JourneymanEntry} from '../../games/journeyman/types';
import type {HistoryEntry as ScoutEntry} from '../../games/scout/types';
import type {HistoryEntry as TeamsheetEntry} from '../../games/teamsheet/types';
import type {HistoryEntry as TenballEntry} from '../../games/tenball/types';
import type {PublishedResult} from './types';

/** The DB rejects scores above this; a rejected row would jam the outbox. */
const MAX_SCORE = 500;

const clamp = (n: number) => Math.max(0, Math.min(n, MAX_SCORE));

/**
 * `'lost'` only exists in logs from before Scout's guesses became unlimited.
 * Right = 1 on a win else 0; wrong = the non-winning guesses (all of them on a
 * fail, one fewer than the total on a win, since the winning guess is correct).
 */
export function fromScoutEntry(entry: ScoutEntry, streak: number): PublishedResult {
  const won = entry.status === 'won';
  return {
    dateKey: entry.dateKey,
    game: 'scout',
    status: won ? 'won' : 'revealed',
    score: clamp(won ? Math.max(0, entry.guessCount - 1) : entry.guessCount),
    total: won ? 1 : 0,
    streak,
  };
}

export function fromJourneymanEntry(
  entry: JourneymanEntry,
  streak: number,
): PublishedResult {
  const won = entry.status === 'won';
  return {
    dateKey: entry.dateKey,
    game: 'journeyman',
    status: entry.status,
    score: clamp(won ? Math.max(0, entry.guessCount - 1) : entry.guessCount),
    total: won ? 1 : 0,
    streak,
  };
}

export function fromTenballEntry(entry: TenballEntry, streak: number): PublishedResult {
  return {
    dateKey: entry.dateKey,
    game: 'tenball',
    status: entry.status,
    score: clamp(entry.misses),
    total: entry.found,
    streak,
  };
}

export function fromTeamsheetEntry(
  entry: TeamsheetEntry,
  streak: number,
): PublishedResult {
  return {
    dateKey: entry.dateKey,
    game: 'teamsheet',
    status: entry.status,
    score: clamp(entry.misses),
    total: entry.found,
    streak,
  };
}

/**
 * The streak value an ongoing row may carry: the game's current streak only
 * while it is actually alive (last completed yesterday). A streak already
 * broken by a missed day would otherwise show on friends' cards until the
 * next finish corrects it.
 */
export function liveStreak(
  streak: {current: number; lastCompletedDateKey: string | null},
  dateKey: string,
): number {
  return streak.lastCompletedDateKey === previousDateKey(dateKey) ? streak.current : 0;
}

/**
 * A live in-progress row: published after each guess, so friends see the eye
 * and the running right/wrong counts; the finish row later replaces it (same
 * day+game key). `right`/`wrong` mirror the finish mappers — found/misses for
 * Top Bins/Team sheet, `0`/guesses-so-far for the guess-one-player games.
 */
export function ongoingResult(
  game: DailyGame,
  dateKey: string,
  right: number,
  wrong: number,
  streak: number,
): PublishedResult {
  return {
    dateKey,
    game,
    status: 'ongoing',
    score: clamp(wrong),
    total: right,
    streak,
  };
}
