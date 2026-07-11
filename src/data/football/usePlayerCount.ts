/**
 * Live count of footballers in the in-memory dataset. Re-renders on its own
 * when an OTA content pack lands (subscribeGeneration fires on hydrate), so the
 * number stays truthful the moment we ship more players over the air.
 */
import {useSyncExternalStore} from 'react';
import {FOOTBALLERS} from './footballers';
import {subscribeGeneration} from './generation';

export function usePlayerCount(): number {
  return useSyncExternalStore(subscribeGeneration, () => FOOTBALLERS.length);
}
