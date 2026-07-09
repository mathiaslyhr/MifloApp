/**
 * Local daily reminder for the Scout puzzle — the only notification the app
 * sends. Scheduled fully on-device (no push infrastructure, nothing leaves the
 * phone): a repeating 09:00 nudge that today's player has dropped.
 *
 * The opt-in prompt is offered ONCE, right after the user finishes their first
 * Scout puzzle (see ScoutScreen) — that's the moment the reminder is worth
 * something to them. A Settings toggle covers changed minds either way.
 */
import notifee, {
  AuthorizationStatus,
  RepeatFrequency,
  TriggerType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const PREF_KEY = 'app.scoutReminder';
const ASKED_KEY = 'app.scoutReminderAsked';
const NOTIFICATION_ID = 'scout-daily';

/** Local hour the nudge lands — when people look at phones, not midnight. */
const REMINDER_HOUR = 9;

function nextReminderTimestamp(): number {
  const at = new Date();
  at.setHours(REMINDER_HOUR, 0, 0, 0);
  if (at.getTime() <= Date.now()) {
    at.setDate(at.getDate() + 1);
  }
  return at.getTime();
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
  await notifee.createTriggerNotification(
    {
      id: NOTIFICATION_ID,
      title: i18n.t('scout.reminderNotifTitle'),
      body: i18n.t('scout.reminderNotifBody'),
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: nextReminderTimestamp(),
      repeatFrequency: RepeatFrequency.DAILY,
    },
  );
  await AsyncStorage.setItem(PREF_KEY, 'on');
  return true;
}

export async function disableScoutReminder(): Promise<void> {
  await notifee.cancelTriggerNotification(NOTIFICATION_ID);
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
