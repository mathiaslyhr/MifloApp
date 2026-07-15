/**
 * The daily nudge for ALL the daily games (currently Scout, Top Bins,
 * Journeyman and Team sheet — a new daily just registers in `dailyStatus.ts`).
 * Scheduled fully on-device: nothing leaves the phone, no push infrastructure.
 *
 * Timing comes from the user's own behaviour rather than a fixed hour: `habit`
 * learns when they are actually free and `nudgePlan` pings just before that,
 * clamped to a sane window. Someone who plays at breakfast still gets 09:00,
 * because that is what their behaviour resolves to.
 *
 * The nudge is a rolling window of 14 one-shot triggers rather than a repeating
 * one, so a lapsed user isn't pinged forever: every sync (launch, foreground,
 * puzzle finish, toggle) re-anchors the full window, and someone who stops
 * opening the app goes quiet after two unanswered weeks until they return.
 * Ids are stable, so re-scheduling upserts instead of stacking.
 *
 * A day gets at most two notifications, and only ever two when something is
 * genuinely at stake. `nudgePlan` owns that rule; this file only renders and
 * talks to notifee.
 *
 * The opt-in prompt is offered ONCE, right after the user finishes their first
 * daily puzzle — whichever daily game that happens to be gets to ask. A
 * Settings toggle covers changed minds either way.
 *
 * Module/key names still say "scout" — they predate the other dailies and the
 * pref key is persisted on devices, so they stay (same policy as the imposter
 * ids).
 */
import notifee, {AuthorizationStatus, TriggerType} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import {dateKeyFor, previousDateKey} from '../../games/scout/dailySeed';
import {loadDailyStatuses} from './dailyStatus';
import {loadHabitSlotMinutes, rememberNudgeFires} from './habit';
import {
  ALL_IDS,
  EVENING_ID,
  LEGACY_EVENING_IDS,
  LEGACY_WINDOW_ID,
  planNudges,
  type PlannedNudge,
} from './nudgePlan';

const PREF_KEY = 'app.scoutReminder';
const ASKED_KEY = 'app.scoutReminderAsked';

const TITLE_KEY = 'scout.reminderNotifTitle';

/** Turn a planned nudge's key and params into the sentence iOS will show. */
function bodyOf(nudge: PlannedNudge): string {
  const {days, count, game} = nudge.params ?? {};
  return i18n.t(nudge.bodyKey, {
    ...(days != null ? {days} : {}),
    ...(count != null ? {count} : {}),
    // The planner stays i18n-free, so it names the game and we look up its title.
    ...(game != null ? {game: i18n.t(`games.${game}.title`)} : {}),
  });
}

function schedule(nudge: PlannedNudge): Promise<string> {
  return notifee.createTriggerNotification(
    {id: nudge.id, title: i18n.t(TITLE_KEY), body: bodyOf(nudge)},
    {type: TriggerType.TIMESTAMP, timestamp: nudge.at},
  );
}

/**
 * Re-anchor everything to what is true right now. Local notifications can't be
 * conditional at delivery, so this is reactive instead: call it whenever the
 * picture may have changed (launch, foreground, puzzle finish, toggle) and it
 * schedules or cancels accordingly. Safe to call often — the ids upsert.
 */
export async function syncNudges(): Promise<void> {
  try {
    if (!(await getScoutReminderPreference())) {
      // Cancel rather than return early, so a device that was mid-flight when
      // the toggle flipped still cleans itself up.
      await notifee.cancelTriggerNotifications(ALL_IDS);
      return;
    }
    const today = dateKeyFor(new Date());
    const [statuses, slotMinutes] = await Promise.all([
      loadDailyStatuses(today),
      loadHabitSlotMinutes(),
    ]);
    const yesterday = previousDateKey(today);
    const plan = planNudges({
      nowMs: Date.now(),
      slotMinutes,
      allFinishedToday: statuses.every(s => s.finishedToday),
      // At risk = a live streak (yesterday completed) that today hasn't extended.
      atRiskDays: statuses
        .filter(
          s =>
            s.streakDays > 0 &&
            s.streakLastCompleted === yesterday &&
            !s.finishedToday,
        )
        .map(s => s.streakDays),
      startedUnfinished: statuses
        .filter(s => s.startedToday && !s.finishedToday)
        .map(s => s.game),
    });
    await notifee.cancelTriggerNotifications([
      LEGACY_WINDOW_ID,
      ...LEGACY_EVENING_IDS,
    ]);
    await Promise.all(plan.window.map(schedule));
    if (plan.evening) {
      await schedule(plan.evening);
    } else {
      await notifee.cancelTriggerNotification(EVENING_ID);
    }
    // The ledger is what lets `habit` tell our own nudges from a free moment.
    await rememberNudgeFires([
      ...plan.window.map(n => n.at),
      ...(plan.evening ? [plan.evening.at] : []),
    ]);
  } catch {
    // Scheduling hiccups must never affect gameplay.
  }
}

/**
 * Ask iOS for permission (first time shows the system prompt) and schedule.
 * Returns false when the user has notifications denied — the caller should tell
 * them where to flip it back on.
 */
export async function enableScoutReminder(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    return false;
  }
  await AsyncStorage.setItem(PREF_KEY, 'on');
  await syncNudges();
  // Instant preview so turning it on shows exactly what the nudge looks like —
  // confirmation and expectation-setting in one.
  await notifee.displayNotification({
    id: 'scout-daily-preview',
    title: i18n.t(TITLE_KEY),
    body: i18n.t('scout.curiosityNotifBody_0'),
    ios: {foregroundPresentationOptions: {banner: true, list: true}},
  });
  return true;
}

export async function disableScoutReminder(): Promise<void> {
  await notifee.cancelTriggerNotifications(ALL_IDS);
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
