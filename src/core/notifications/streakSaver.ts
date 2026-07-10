/**
 * Streak-saver nudge — a single one-shot 20:00 local notification on days
 * where at least one daily game's active streak would die unplayed. One
 * notification no matter how many streaks are at risk: the game's own copy
 * when it's just one, combined "streaks on the line" copy when several are.
 * (These used to be four per-game nudges staggered 20:00 to 20:15, which
 * read as a barrage on a four-streak evening.)
 *
 * Local notifications can't be conditional at delivery time, so this is
 * synced reactively instead: call `syncStreakSaver` whenever the picture may
 * have changed (app launch, puzzle finished, reminder toggled) and it
 * schedules or cancels tonight's nudge accordingly.
 *
 * Piggybacks on the daily-reminder opt-in — one preference governs the 09:00
 * nudge and this rescue ping.
 */
import notifee, {TriggerType} from '@notifee/react-native';
import i18n from '../i18n';
import {dateKeyFor, previousDateKey} from '../../games/scout/dailySeed';
import {loadDailyStatuses} from './dailyStatus';
import {getScoutReminderPreference} from './scoutReminder';

const NOTIFICATION_ID = 'streak-saver';
/** Ids of the old per-game nudges; devices that scheduled them before the
 * coalesced saver shipped still have them pending, so they must keep being
 * cancelled or tonight could ping twice. */
const LEGACY_IDS = [
  'scout-streak',
  'tenball-streak',
  'journeyman-streak',
  'teamsheet-streak',
];

/** Evening, late enough to be a rescue, early enough to act on. */
const STREAK_HOUR = 20;

export async function syncStreakSaver(): Promise<void> {
  try {
    const cancelAll = () =>
      notifee.cancelTriggerNotifications([NOTIFICATION_ID, ...LEGACY_IDS]);
    if (!(await getScoutReminderPreference())) {
      await cancelAll();
      return;
    }
    const today = dateKeyFor(new Date());
    const statuses = await loadDailyStatuses(today);
    // At risk = a live streak (yesterday completed) that today hasn't extended.
    const atRisk = statuses.filter(
      s =>
        s.streakDays > 0 &&
        s.streakLastCompleted === previousDateKey(today) &&
        !s.finishedToday,
    );
    const at = new Date();
    at.setHours(STREAK_HOUR, 0, 0, 0);
    if (atRisk.length === 0 || at.getTime() <= Date.now()) {
      await cancelAll();
      return;
    }
    await notifee.cancelTriggerNotifications(LEGACY_IDS);
    const body =
      atRisk.length === 1
        ? i18n.t(`${atRisk[0].game}.streakNotifBody`, {
            days: atRisk[0].streakDays,
          })
        : i18n.t('scout.streaksNotifBody', {count: atRisk.length});
    await notifee.createTriggerNotification(
      {
        id: NOTIFICATION_ID,
        title: i18n.t('scout.streakNotifTitle'),
        body,
      },
      {type: TriggerType.TIMESTAMP, timestamp: at.getTime()},
    );
  } catch {
    // Scheduling hiccups must never affect gameplay.
  }
}
