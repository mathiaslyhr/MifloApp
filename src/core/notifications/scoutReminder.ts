/**
 * Local daily reminder for ALL the daily games (currently Scout, Top Bins,
 * Journeyman and Team sheet — a new daily just adds its progress loader to
 * `solvedToday` below and its own streak saver). Scheduled fully on-device
 * (no push infrastructure, nothing leaves the phone): a repeating 09:00
 * nudge that today's games have dropped, skipped on mornings where every
 * daily is already finished.
 *
 * The opt-in prompt is offered ONCE, right after the user finishes their
 * first daily puzzle — whichever daily game that happens to be gets to ask.
 * A Settings toggle covers changed minds either way.
 *
 * Module/key names still say "scout" — they predate the other dailies and
 * the pref key is persisted on devices, so they stay (same policy as the
 * imposter ids).
 */
import notifee, {
  AuthorizationStatus,
  RepeatFrequency,
  TriggerType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import {loadDailyProgress as loadJourneymanProgress} from '../../games/journeyman/storage';
import {dateKeyFor} from '../../games/scout/dailySeed';
import {loadDailyProgress} from '../../games/scout/mysteryStorage';
import {loadDailyProgress as loadTeamsheetProgress} from '../../games/teamsheet/storage';
import {loadDailyProgress as loadTenballProgress} from '../../games/tenball/storage';

const PREF_KEY = 'app.scoutReminder';
const ASKED_KEY = 'app.scoutReminderAsked';
const NOTIFICATION_ID = 'scout-daily';

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
 * Re-anchor the repeating 09:00 trigger to the next morning that actually
 * needs a nudge — local notifications can't be conditional at delivery, so a
 * day where EVERY daily game is already finished is skipped by moving the
 * anchor to tomorrow. Reactive like the streak savers: call on launch, on
 * puzzle finish, and when the toggle flips. No-op while the reminder is off.
 */
export async function syncScoutReminder(): Promise<void> {
  try {
    if (!(await getScoutReminderPreference())) {
      return;
    }
    const today = dateKeyFor(new Date());
    const [scout, tenball, journeyman, teamsheet] = await Promise.all([
      loadDailyProgress(today),
      loadTenballProgress(today),
      loadJourneymanProgress(today),
      loadTeamsheetProgress(today),
    ]);
    const scoutDone =
      scout?.secretId != null && scout.guessedIds.includes(scout.secretId);
    const tenballDone =
      tenball != null &&
      (tenball.gaveUp ||
        new Set(tenball.guesses.map(g => g.rank).filter(r => r !== undefined))
          .size === 10);
    const journeymanDone =
      journeyman != null &&
      (journeyman.gaveUp ||
        (journeyman.secretId != null &&
          journeyman.guessedIds.includes(journeyman.secretId)));
    const teamsheetDone =
      teamsheet != null &&
      (teamsheet.gaveUp ||
        new Set(teamsheet.guesses.map(g => g.slot).filter(s => s !== undefined))
          .size === 11);
    const solvedToday = scoutDone && tenballDone && journeymanDone && teamsheetDone;
    await notifee.createTriggerNotification(
      {
        id: NOTIFICATION_ID,
        title: i18n.t('scout.reminderNotifTitle'),
        body: i18n.t('scout.reminderNotifBody'),
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: nextReminderTimestamp(solvedToday),
        repeatFrequency: RepeatFrequency.DAILY,
      },
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
