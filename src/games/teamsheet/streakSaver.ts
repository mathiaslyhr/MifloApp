/**
 * Team sheet streak-saver nudge — a one-shot 20:15 local notification on days
 * where an active Team sheet streak would die unplayed. Same reactive model
 * as the other daily games' streak savers: call `syncTeamsheetStreakSaver`
 * whenever the picture may have changed (app launch, puzzle finished,
 * reminder toggled) and it schedules or cancels tonight's nudge accordingly.
 *
 * Piggybacks on the shared daily-reminder opt-in — one preference governs the
 * 09:00 nudge and every daily game's rescue ping.
 */
import notifee, {TriggerType} from '@notifee/react-native';
import i18n from '../../core/i18n';
import {getScoutReminderPreference} from '../../core/notifications/scoutReminder';
import {dateKeyFor, previousDateKey} from '../scout/dailySeed';
import {loadDailyProgress, loadStreak} from './storage';

const STREAK_NOTIFICATION_ID = 'teamsheet-streak';

/** Evening rescue slot, staggered after Scout (20:00), Top Bins (20:05) and
 * Journeyman (20:10) so four at-risk streaks never stack at the same minute. */
const STREAK_HOUR = 20;
const STREAK_MINUTE = 15;

export async function syncTeamsheetStreakSaver(): Promise<void> {
  try {
    const cancel = () =>
      notifee.cancelTriggerNotification(STREAK_NOTIFICATION_ID);
    if (!(await getScoutReminderPreference())) {
      await cancel();
      return;
    }
    const today = dateKeyFor(new Date());
    const [streak, progress] = await Promise.all([
      loadStreak(),
      loadDailyProgress(today),
    ]);
    const finishedToday =
      progress != null &&
      (progress.gaveUp ||
        new Set(progress.guesses.map(g => g.slot).filter(s => s !== undefined))
          .size === 11);
    // At risk = a live streak (yesterday completed) that today hasn't extended.
    const atRisk =
      streak.current > 0 &&
      streak.lastCompletedDateKey === previousDateKey(today) &&
      !finishedToday;
    const at = new Date();
    at.setHours(STREAK_HOUR, STREAK_MINUTE, 0, 0);
    if (!atRisk || at.getTime() <= Date.now()) {
      await cancel();
      return;
    }
    await notifee.createTriggerNotification(
      {
        id: STREAK_NOTIFICATION_ID,
        title: i18n.t('teamsheet.streakNotifTitle'),
        body: i18n.t('teamsheet.streakNotifBody', {days: streak.current}),
      },
      {type: TriggerType.TIMESTAMP, timestamp: at.getTime()},
    );
  } catch {
    // Scheduling hiccups must never affect gameplay.
  }
}
