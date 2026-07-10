/**
 * Local daily reminder for ALL the daily games (currently Scout, Top Bins,
 * Journeyman and Team sheet — a new daily just registers in
 * `dailyStatus.ts`). Scheduled fully on-device (no push infrastructure,
 * nothing leaves the phone): a 09:00 nudge that today's games have dropped,
 * skipped on mornings where every daily is already finished.
 *
 * The nudge is a rolling window of 14 one-shot triggers rather than a
 * repeating one, so a lapsed user isn't pinged forever: every sync (launch,
 * puzzle finish, toggle) re-anchors the full window, and someone who stops
 * opening the app goes quiet after two unanswered weeks until they return.
 *
 * The opt-in prompt is offered ONCE, right after the user finishes their
 * first daily puzzle — whichever daily game that happens to be gets to ask.
 * A Settings toggle covers changed minds either way.
 *
 * Module/key names still say "scout" — they predate the other dailies and
 * the pref key is persisted on devices, so they stay (same policy as the
 * imposter ids).
 */
import notifee, {AuthorizationStatus, TriggerType} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {loadDailyStatuses} from './dailyStatus';

const PREF_KEY = 'app.scoutReminder';
const ASKED_KEY = 'app.scoutReminderAsked';

/** Mornings scheduled ahead before a lapsed user's reminders go quiet. */
const WINDOW_DAYS = 14;
const WINDOW_IDS = Array.from(
  {length: WINDOW_DAYS},
  (_, day) => `scout-daily-${day}`,
);
/** Id of the pre-window repeating trigger; devices that scheduled it before
 * the 14-day window shipped still have it pending, so it must keep being
 * cancelled or they would be pinged twice each morning. */
const LEGACY_NOTIFICATION_ID = 'scout-daily';

/** Local hour the nudge lands — when people look at phones, not midnight. */
const REMINDER_HOUR = 9;

function nextReminderTimestamp(skipToday: boolean): number {
  const at = new Date();
  at.setHours(REMINDER_HOUR, 0, 0, 0);
  if (skipToday || at.getTime() <= Date.now()) {
    at.setDate(at.getDate() + 1);
  }
  return at.getTime();
}

/**
 * Re-anchor the 14-day window of 09:00 triggers to the next morning that
 * actually needs a nudge — local notifications can't be conditional at
 * delivery, so a day where EVERY daily game is already finished is skipped by
 * starting the window tomorrow. Reactive like the streak saver: call on
 * launch, on puzzle finish, and when the toggle flips. No-op while the
 * reminder is off.
 */
export async function syncScoutReminder(): Promise<void> {
  try {
    if (!(await getScoutReminderPreference())) {
      return;
    }
    const statuses = await loadDailyStatuses(dateKeyFor(new Date()));
    const solvedToday = statuses.every(s => s.finishedToday);
    const first = nextReminderTimestamp(solvedToday);
    await notifee.cancelTriggerNotification(LEGACY_NOTIFICATION_ID);
    await Promise.all(
      WINDOW_IDS.map((id, day) => {
        // setDate (not day * 24h) so the nudge stays at 09:00 across DST.
        const at = new Date(first);
        at.setDate(at.getDate() + day);
        return notifee.createTriggerNotification(
          {
            id,
            title: i18n.t('scout.reminderNotifTitle'),
            body: i18n.t('scout.reminderNotifBody'),
          },
          {type: TriggerType.TIMESTAMP, timestamp: at.getTime()},
        );
      }),
    );
  } catch {
    // Scheduling hiccups must never affect gameplay.
  }
}

/**
 * Ask iOS for permission (first time shows the system prompt) and schedule the
 * daily trigger. Returns false when the user has notifications denied — the
 * caller should tell them where to flip it back on.
 */
export async function enableScoutReminder(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    return false;
  }
  await AsyncStorage.setItem(PREF_KEY, 'on');
  await syncScoutReminder();
  // Instant preview so turning it on shows exactly what the daily nudge looks
  // like — confirmation and expectation-setting in one.
  await notifee.displayNotification({
    id: 'scout-daily-preview',
    title: i18n.t('scout.reminderNotifTitle'),
    body: i18n.t('scout.reminderNotifBody'),
    ios: {foregroundPresentationOptions: {banner: true, list: true}},
  });
  return true;
}

export async function disableScoutReminder(): Promise<void> {
  await notifee.cancelTriggerNotifications([
    LEGACY_NOTIFICATION_ID,
    ...WINDOW_IDS,
  ]);
  await AsyncStorage.setItem(PREF_KEY, 'off');
}

/** Saved toggle state (defaults off — reminders are strictly opt-in). */
export async function getScoutReminderPreference(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === 'on';
  } catch {
    return false;
  }
}

/** True until the one-time post-puzzle offer has been shown. */
export async function shouldOfferScoutReminder(): Promise<boolean> {
  try {
    const [asked, pref] = await Promise.all([
      AsyncStorage.getItem(ASKED_KEY),
      AsyncStorage.getItem(PREF_KEY),
    ]);
    return asked == null && pref !== 'on';
  } catch {
    return false;
  }
}

export async function markScoutReminderOffered(): Promise<void> {
  await AsyncStorage.setItem(ASKED_KEY, '1');
}
