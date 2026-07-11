/**
 * @format
 */

// Gesture-handler must be the first import so its native handlers register
// before any view mounts (required for Release builds).
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { initSentry, Sentry } from './src/core/observability/sentry';
import { registerPushInviteBackgroundHandler } from './src/core/notifications/pushInvites';

// Initialize crash reporting before anything renders (no-op unless a DSN is set
// and this is a Release build). Sentry.wrap adds error-boundary + touch context.
initSentry();

// Notifee requires the background press handler registered at module scope,
// before the app component mounts (party-invite pushes tapped from background).
registerPushInviteBackgroundHandler();

AppRegistry.registerComponent(appName, () => Sentry.wrap(App));
