/**
 * Offline-safe publish queue for daily results. The daily games finish in
 * flight mode, so a finish always lands here first (a local AsyncStorage
 * write that virtually never fails) and the network flush is fire-and-forget:
 * on app start, on Social tab focus, and right after queueing. Publishing is
 * a no-op until the device has opted in (created a profile), which also means
 * results queued before opting in get published at onboarding.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {previousDateKey} from '../../games/scout/dailySeed';
import {isBackendConfigured} from '../config';
import {collectMyResults} from './myResults';
import {getCachedProfile, publishResults} from './socialService';
import type {PublishedResult} from './types';

const OUTBOX_KEY = 'social.outbox';
const BACKFILLED_KEY = 'social.backfilled';

/** Entries older than this are dropped — the feed never looks that far back. */
const MAX_AGE_DAYS = 14;
/** Hard cap as a backstop (4 games x 14 days is the natural ceiling). */
const MAX_ENTRIES = 60;

function cutoffDateKey(todayKey: string): string {
  let key = todayKey;
  for (let i = 0; i < MAX_AGE_DAYS; i++) {
    key = previousDateKey(key);
  }
  return key;
}

async function loadQueue(): Promise<PublishedResult[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as PublishedResult[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: PublishedResult[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
}

/**
 * Pure upsert: replace same-day same-game entries, drop everything older than
 * the cutoff, keep at most MAX_ENTRIES (newest win). Exported for tests.
 */
export function upsertEntries(
  queue: PublishedResult[],
  entries: PublishedResult[],
  todayKey: string,
): PublishedResult[] {
  const cutoff = cutoffDateKey(todayKey);
  const byKey = new Map<string, PublishedResult>();
  for (const entry of [...queue, ...entries]) {
    if (entry.dateKey >= cutoff) {
      byKey.set(`${entry.game}|${entry.dateKey}`, entry);
    }
  }
  // YYYY-MM-DD sorts lexicographically; keep the newest when over the cap.
  return [...byKey.values()]
    .sort((a, b) => (a.dateKey === b.dateKey ? 0 : a.dateKey < b.dateKey ? 1 : -1))
    .slice(0, MAX_ENTRIES);
}

/**
 * Queue one finished day and kick off a flush. Never throws for network
 * reasons; only the local write can reject. Callers at game finish points
 * still attach `.catch(() => {})` — publishing must never degrade the game.
 */
export async function queueDailyResult(entry: PublishedResult): Promise<void> {
  const queue = await loadQueue();
  await saveQueue(upsertEntries(queue, [entry], entry.dateKey));
  flushOutbox().catch(() => {});
}

let flushing: Promise<void> | null = null;

/**
 * Push the queued entries to the backend and clear what was sent. Quietly
 * does nothing while offline, unconfigured, or before the profile exists;
 * failures keep the queue for the next trigger. Single-flight.
 */
export function flushOutbox(): Promise<void> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(): Promise<void> {
  if (!isBackendConfigured) {
    return;
  }
  if (!(await getCachedProfile())) {
    return;
  }
  const sent = await loadQueue();
  if (sent.length === 0) {
    return;
  }
  try {
    await publishResults(sent);
  } catch {
    return; // Keep the queue; the next trigger retries.
  }
  // Clear only what went out — an entry replaced mid-flight stays queued.
  const now = await loadQueue();
  const sentByKey = new Map(sent.map(e => [`${e.game}|${e.dateKey}`, e]));
  const remaining = now.filter(e => {
    const match = sentByKey.get(`${e.game}|${e.dateKey}`);
    return !match || JSON.stringify(match) !== JSON.stringify(e);
  });
  if (remaining.length !== now.length) {
    await saveQueue(remaining);
  }
}

/**
 * One-time backfill after opting in: queue the last 14 days from every
 * game's local history so friends see more than an empty card on day one.
 * Streaks are only attached to each game's `lastCompletedDateKey` entry (the
 * only row the UI reads streak from); older rows carry 0.
 */
export async function runBackfill(todayKey: string): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(BACKFILLED_KEY)) === 'true') {
      return;
    }
  } catch {
    return;
  }
  const {results: entries} = await collectMyResults(cutoffDateKey(todayKey), todayKey);
  const queue = await loadQueue();
  await saveQueue(upsertEntries(queue, entries, todayKey));
  await AsyncStorage.setItem(BACKFILLED_KEY, 'true');
  await flushOutbox();
}
