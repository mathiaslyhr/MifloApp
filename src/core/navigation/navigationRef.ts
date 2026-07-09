/**
 * Imperative handle on the root NavigationContainer (wired in App.tsx), for
 * code that needs to know where the user is without living inside a screen —
 * today only the OTA dataset sync, which must not swap data mid-game.
 */
import {createNavigationContainerRef} from '@react-navigation/native';
import type {RootStackParamList} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** The focused route's name, or undefined before the container is ready. */
export function currentRouteName(): string | undefined {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
}
