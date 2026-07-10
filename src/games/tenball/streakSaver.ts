/**
 * Top Bins streak-saver nudge — a one-shot 20:00 local notification on days
 * where an active Top Bins streak would die unplayed. Same reactive model as
 * the Scout streak saver: call `syncTenballStreakSaver` whenever the picture
 * may have changed (app launch, board finished, reminder toggled) and it
 * schedules or cancels tonight's nudge accordingly.
 *
 * Piggybacks on the shared daily-reminder opt-in — one preference governs the
 * 09:00 nudge and both games' rescue pings.
 */
import notifee, {TriggerType} from '@notifee/react-native';
import i18n from '../../core/i18n';
import {getScoutReminderPreference} from '../../core/notifications/scoutReminder';
import {dateKeyFor, previousDateKey} from '../scout/dailySeed';
import {loadDailyProgress, loadStreak} from './storage';

const STREAK_NOTIFICATION_ID = 'tenball-streak';

/** Evening, late enough to be a rescue, early enough to act on. Five minutes
 * after Scout's nudge so two at-risk streaks never stack at exactly 20:00. */
const STREAK_HOUR = 20;
const STREAK_MINUTE = 5;

export async function syncTenballStreakSaver(): Promise<void> {
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
        new Set(progress.guesses.map(g => g.rank).filter(r => r !== undefined))
          .size === 10);
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
        title: i18n.t('tenball.streakNotifTitle'),
        body: i18n.t('tenball.streakNotifBody', {days: streak.current}),
      },
      {type: TriggerType.TIMESTAMP, timestamp: at.getTime()},
    );
  } catch {
    // Scheduling hiccups must never affect gameplay.
  }
}
