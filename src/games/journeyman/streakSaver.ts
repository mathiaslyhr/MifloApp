/**
 * Journeyman streak-saver nudge — a one-shot 20:10 local notification on days
 * where an active Journeyman streak would die unplayed. Same reactive model as
 * the Scout and Top Bins streak savers: call `syncJourneymanStreakSaver`
 * whenever the picture may have changed (app launch, puzzle finished, reminder
 * toggled) and it schedules or cancels tonight's nudge accordingly.
 *
 * Piggybacks on the shared daily-reminder opt-in — one preference governs the
 * 09:00 nudge and every daily game's rescue ping.
 */
import notifee, {TriggerType} from '@notifee/react-native';
import i18n from '../../core/i18n';
import {getScoutReminderPreference} from '../../core/notifications/scoutReminder';
import {dateKeyFor, previousDateKey} from '../scout/dailySeed';
import {loadDailyProgress, loadStreak} from './storage';

const STREAK_NOTIFICATION_ID = 'journeyman-streak';

/** Evening rescue slot, staggered after Scout (20:00) and Top Bins (20:05) so
 * three at-risk streaks never stack at the same minute. */
const STREAK_HOUR = 20;
const STREAK_MINUTE = 10;

export async function syncJourneymanStreakSaver(): Promise<void> {
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
        (progress.secretId != null &&
          progress.guessedIds.includes(progress.secretId)));
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
        title: i18n.t('journeyman.streakNotifTitle'),
        body: i18n.t('journeyman.streakNotifBody', {days: streak.current}),
      },
      {type: TriggerType.TIMESTAMP, timestamp: at.getTime()},
    );
  } catch {
    // Scheduling hiccups must never affect gameplay.
  }
}
