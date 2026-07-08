/**
 * @format
 */

import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { initSentry, Sentry } from './src/core/observability/sentry';

// Initialize crash reporting before anything renders (no-op unless a DSN is set
// and this is a Release build). Sentry.wrap adds error-boundary + touch context.
initSentry();

AppRegistry.registerComponent(appName, () => Sentry.wrap(App));
