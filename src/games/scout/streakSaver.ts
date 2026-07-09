/**
 * Streak-saver nudge — a one-shot 20:00 local notification on days where an
 * active streak would die unplayed. Local notifications can't be conditional
 * at delivery time, so this is synced reactively instead: call `syncStreakSaver`
 * whenever the picture may have changed (app launch, puzzle solved, reminder
 * toggled) and it schedules or cancels tonight's nudge accordingly.
 *
 * Piggybacks on the Scout reminder opt-in — one preference governs both the
 * 09:00 daily nudge and this rescue ping.
 */
import notifee, {TriggerType} from '@notifee/react-native';
import i18n from '../../core/i18n';
import {getScoutReminderPreference} from '../../core/notifications/scoutReminder';
import {dateKeyFor, previousDateKey} from './dailySeed';
import {loadDailyProgress, loadStreak} from './mysteryStorage';

const STREAK_NOTIFICATION_ID = 'scout-streak';

/** Evening, late enough to be a rescue, early enough to act on. */
const STREAK_HOUR = 20;

export async function syncStreakSaver(): Promise<void> {
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
    const solvedToday =
      progress?.secretId != null &&
      progress.guessedIds.includes(progress.secretId);
    // At risk = a live streak (yesterday solved) that today hasn't extended.
    const atRisk =
      streak.current > 0 &&
      streak.lastCompletedDateKey === previousDateKey(today) &&
      !solvedToday;
    const at = new Date();
    at.setHours(STREAK_HOUR, 0, 0, 0);
    if (!atRisk || at.getTime() <= Date.now()) {
      await cancel();
      return;
    }
    await notifee.createTriggerNotification(
      {
        id: STREAK_NOTIFICATION_ID,
        title: i18n.t('scout.streakNotifTitle'),
        body: i18n.t('scout.streakNotifBody', {days: streak.current}),
      },
      {type: TriggerType.TIMESTAMP, timestamp: at.getTime()},
    );
  } catch {
    // Scheduling hiccups must never affect gameplay.
  }
}
