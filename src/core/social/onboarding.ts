/**
 * The one social opt-in flow, shared by every entry point (the Friends tab's
 * onboarding card, the Profile tab's setup block): create the profile, then
 * kick off the two fire-and-forget follow-ups that make the profile useful —
 * seeding friends with recent history and becoming reachable for pushes.
 */
import {requestPushPermissionAndSync} from '../notifications/pushInvites';
import {runBackfill} from './outbox';
import {createProfile} from './socialService';
import type {SocialProfile} from './types';

/**
 * Opt into Friends under `name`. Throws when the profile can't be created
 * (callers toast); the follow-ups never throw.
 */
export async function optInToSocial(
  name: string,
  todayKey: string,
): Promise<SocialProfile> {
  const created = await createProfile(name);
  // First publish: seed the last 14 days from local history, so friends see
  // more than an empty card on day one.
  runBackfill(todayKey).catch(() => {});
  // Opting into Friends is the moment this phone becomes reachable — ask for
  // notification permission and upload the push token.
  requestPushPermissionAndSync().catch(() => {});
  return created;
}
