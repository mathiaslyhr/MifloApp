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
import {Alert, StatusBar, StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import type {LinkingOptions} from '@react-navigation/native';
import {RootNavigator} from './src/core/navigation';
import type {RootStackParamList} from './src/core/navigation';
import {navigationRef} from './src/core/navigation/navigationRef';
import {
  initFootballDataSync,
  maybeApplyPending,
} from './src/data/football/remote/datasetSync';
import {ErrorBoundary, ToastHost} from './src/core/ui';
import {UpdateGate} from './src/core/version';
import {ensureSession} from './src/core/supabase/client';
// Side-effect: initialize i18next (device language) before any screen renders.
import {loadStoredLanguage} from './src/core/i18n';
import {loadHapticsPreference} from './src/core/settings/preferences';
import {syncScoutReminder} from './src/core/notifications/scoutReminder';
import {syncStreakSaver} from './src/core/notifications/streakSaver';
import {
  flushPendingNavigation,
  initPushInviteListeners,
  syncPushToken,
} from './src/core/notifications/pushInvites';
import {flushOutbox} from './src/core/social/outbox';
import {reconcileStaleDailyProgress} from './src/core/daily/reconcile';
import {dateKeyFor} from './src/games/scout/dailySeed';
import {startPresenceHeartbeat} from './src/core/social/presence';
import {startRequestsRefresh} from './src/core/social/requestsStore';
import {Sentry, isSentryEnabled} from './src/core/observability/sentry';

/**
 * Deep links into the app. Only the party join link is routable from outside
 * (https://miflo.dk/join/CODE via Associated Domains, miflo://join/CODE as the
 * custom-scheme fallback) — everything else stays app-internal.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://miflo.dk', 'miflo://'],
  config: {screens: {Join: 'join/:code', Tabs: 'add/:addCode'}},
};

function App(): React.JSX.Element {
  // Sign in anonymously up front so rooms feel instant; non-fatal and a no-op
  // when the backend isn't configured.
  useEffect(() => {
    ensureSession().catch(() => {});
    // Apply saved language override + haptics preference (device language and
    // haptics-on are the synchronous defaults until these resolve).
    loadStoredLanguage().catch(() => {});
    loadHapticsPreference().catch(() => {});
    // Schedule/cancel tonight's streak-saver nudge and re-anchor the 09:00
    // reminder (skips mornings where every daily game is already finished).
    syncStreakSaver();
    syncScoutReminder().catch(() => {});
    // OTA game content: apply the cached pack, then poll for a newer one on
    // launch + every foreground. Fails silently — bundled data always works.
    initFootballDataSync().catch(() => {});
    // A daily left unfinished when the calendar rolled over has no history
    // entry and would vanish from the archive; promote it to a failed result
    // (own log + friends' wire) before flushing, so it goes out in this flush.
    // Daily results finished offline (flight mode) also wait in the social
    // outbox; retry publishing them on every launch. No-op pre-opt-in.
    reconcileStaleDailyProgress(dateKeyFor(new Date()))
      .catch(() => {})
      .finally(() => flushOutbox().catch(() => {}));
    // Friends presence: beat "I'm here" while foregrounded (green dot / last
    // active on friends' tabs). Also a no-op before opting into Friends.
    startPresenceHeartbeat();
    // Remote pushes: re-upload the APNs token when permission was already
    // granted (never prompts) and listen for push taps (party invite → Join,
    // friend request/accept → Friends tab).
    syncPushToken();
    // Friend requests: load them now and on every foreground, so the Friends
    // tab badge is honest even if the push was dismissed. No-op pre-opt-in.
    startRequestsRefresh();
    return initPushInviteListeners();
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
      {/* Root for react-native-gesture-handler (the swipeable game tiles). */}
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" />
          <UpdateGate>
            {/* navigationRef + onStateChange let the OTA content sync apply a
                downloaded pack the moment the user leaves a game screen. */}
            <NavigationContainer
              ref={navigationRef}
              linking={linking}
              onReady={flushPendingNavigation}
              onStateChange={maybeApplyPending}>
              <RootNavigator />
            </NavigationContainer>
          </UpdateGate>
          <ToastHost />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});

export default App;
