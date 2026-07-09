/**
 * Miflo — social party games for friends in the same room.
 *
 * The app shell: a native-stack root (see `src/core/navigation`) whose home
 * route is the Home/Games/Menu tab shell. The game engine, football data and
 * Supabase backend live under `src/` and are wired into screens as they're built.
 *
 * @format
 */
import React, {useEffect} from 'react';
import {Alert, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {RootNavigator} from './src/core/navigation';
import {ErrorBoundary, ToastHost} from './src/core/ui';
import {UpdateGate} from './src/core/version';
import {ensureSession} from './src/core/supabase/client';
// Side-effect: initialize i18next (device language) before any screen renders.
import {loadStoredLanguage} from './src/core/i18n';
import {loadHapticsPreference} from './src/core/settings/preferences';
import {Sentry, isSentryEnabled} from './src/core/observability/sentry';

function App(): React.JSX.Element {
  // Sign in anonymously up front so rooms feel instant; non-fatal and a no-op
  // when the backend isn't configured.
  useEffect(() => {
    ensureSession().catch(() => {});
    // Apply saved language override + haptics preference (device language and
    // haptics-on are the synchronous defaults until these resolve).
    loadStoredLanguage().catch(() => {});
    loadHapticsPreference().catch(() => {});
  }, []);

  // Surface uncaught JS errors (event handlers, effects, async) that an error
  // boundary can't catch. In dev, Alert the stack so it's visible instead of the
  // app silently closing; in Release, report to Sentry (when enabled) and stay
  // out of the user's way.
  useEffect(() => {
    const util = (globalThis as {ErrorUtils?: any}).ErrorUtils;
    if (!util?.setGlobalHandler) {
      return;
    }
    util.setGlobalHandler((error: any, isFatal?: boolean) => {
      if (__DEV__) {
        const top = String(error?.stack ?? '').split('\n').slice(0, 8).join('\n');
        Alert.alert(
          `JS error${isFatal ? ' (fatal)' : ''}`,
          `${String(error?.message ?? error)}\n\n${top}`,
        );
        return;
      }
      if (isSentryEnabled) {
        Sentry.captureException(error, {level: isFatal ? 'fatal' : 'error'});
      }
    });
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <UpdateGate>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </UpdateGate>
        <ToastHost />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;
