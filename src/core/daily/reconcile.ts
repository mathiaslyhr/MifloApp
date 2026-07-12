/**
 * Rollover reconcile. A daily's progress lives in a single, today-only slot,
 * so a day left unfinished when the calendar moves on would otherwise vanish
 * from the archive — no history entry is ever written, and the slot reads back
 * as "not played". On launch this promotes such a stale, played-but-unfinished
 * day into a `revealed` (failed) result, both locally (so the owner's log shows
 * the red cross with the counts they had) and on the wire (so friends stop
 * seeing a stale `ongoing` row).
 *
 * Idempotent: a day already in history is skipped, and the stale slot is
 * cleared once handled, so a second launch is a no-op. Only the most recently
 * played abandoned day is recoverable — the single progress slot is
 * overwritten when the next day is opened. Fails soft per game so one broken
 * read never blocks the others. Counts trust the stored rank/slot exactly as
 * the log's ongoing path does — no list/lineup reload.
 */
import {queueDailyResult} from '../social/outbox';
import {
  fromJourneymanEntry,
  fromScoutEntry,
  fromTeamsheetEntry,
  fromTenballEntry,
} from '../social/normalize';
import * as scout from '../../games/scout/mysteryStorage';
import * as journeyman from '../../games/journeyman/storage';
import * as tenball from '../../games/tenball/storage';
import * as teamsheet from '../../games/teamsheet/storage';
import type {HistoryEntry as JourneymanEntry} from '../../games/journeyman/types';
import type {HistoryEntry as ScoutEntry} from '../../games/scout/types';
import type {HistoryEntry as TeamsheetEntry} from '../../games/teamsheet/types';
import type {HistoryEntry as TenballEntry} from '../../games/tenball/types';

async function reconcileScout(todayKey: string): Promise<void> {
  try {
    const p = await scout.loadRawProgress();
    if (!p || p.dateKey >= todayKey || p.guessedIds.length === 0) {
      return;
    }
    if ((await scout.loadHistory())[p.dateKey]) {
      await scout.clearProgress();
      return;
    }
    // Scout never solved -> a `'lost'` day (its failed state; `historyEntryFor`
    // only ever builds wins, so this entry is built by hand).
    const entry: ScoutEntry = {
      dateKey: p.dateKey,
      status: 'lost',
      guessCount: p.guessedIds.length,
    };
    await scout.recordHistory(entry);
    await queueDailyResult(fromScoutEntry(entry, 0));
    await scout.clearProgress();
  } catch {
    // Fail soft — a broken read for one game must not block the others.
  }
}

async function reconcileJourneyman(todayKey: string): Promise<void> {
  try {
    const p = await journeyman.loadRawProgress();
    if (!p || p.dateKey >= todayKey || p.guessedIds.length === 0) {
      return;
    }
    if ((await journeyman.loadHistory())[p.dateKey]) {
      await journeyman.clearProgress();
      return;
    }
    const entry: JourneymanEntry = {
      dateKey: p.dateKey,
      status: 'revealed',
      guessCount: p.guessedIds.length,
    };
    await journeyman.recordHistory(entry);
    await queueDailyResult(fromJourneymanEntry(entry, 0));
    await journeyman.clearProgress();
  } catch {
    // Fail soft.
  }
}

async function reconcileTenball(todayKey: string): Promise<void> {
  try {
    const p = await tenball.loadRawProgress();
    if (!p || p.dateKey >= todayKey || p.guesses.length === 0) {
      return;
    }
    if ((await tenball.loadHistory())[p.dateKey]) {
      await tenball.clearProgress();
      return;
    }
    const found = p.guesses.filter(g => g.rank !== undefined).length;
    const entry: TenballEntry = {
      dateKey: p.dateKey,
      listId: p.listId,
      status: 'revealed',
      found,
      misses: p.guesses.length - found,
    };
    await tenball.recordHistory(entry);
    await queueDailyResult(fromTenballEntry(entry, 0));
    await tenball.clearProgress();
  } catch {
    // Fail soft.
  }
}

async function reconcileTeamsheet(todayKey: string): Promise<void> {
  try {
    const p = await teamsheet.loadRawProgress();
    if (!p || p.dateKey >= todayKey || p.guesses.length === 0) {
      return;
    }
    if ((await teamsheet.loadHistory())[p.dateKey]) {
      await teamsheet.clearProgress();
      return;
    }
    const found = p.guesses.filter(g => g.slot !== undefined).length;
    const entry: TeamsheetEntry = {
      dateKey: p.dateKey,
      lineupId: p.lineupId,
      status: 'revealed',
      found,
      misses: p.guesses.length - found,
    };
    await teamsheet.recordHistory(entry);
    await queueDailyResult(fromTeamsheetEntry(entry, 0));
    await teamsheet.clearProgress();
  } catch {
    // Fail soft.
  }
}

/**
 * Promote every game's stale, played-but-unfinished day into a failed result.
 * Call at launch, before `flushOutbox`, so the queued `revealed` rows go out
 * in the same flush.
 */
export async function reconcileStaleDailyProgress(todayKey: string): Promise<void> {
  await Promise.all([
    reconcileScout(todayKey),
    reconcileJourneyman(todayKey),
    reconcileTenball(todayKey),
    reconcileTeamsheet(todayKey),
  ]);
}
