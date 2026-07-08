/**
 * Sentry crash reporting.
 *
 * Initialized once at startup from `index.js`, before the app renders. Only
 * active in Release builds that have a non-empty `SENTRY_DSN` — so dev sessions
 * never send events and the app runs untouched when no DSN is configured.
 *
 * Privacy: Miflo collects no PII by design. We explicitly disable default PII,
 * turn off performance tracing, and strip any user context before sending, so
 * events carry only the crash/error itself — matching the App Privacy label
 * (Crash Data / Diagnostics, not linked to identity, not used for tracking).
 */
import * as Sentry from '@sentry/react-native';
import {SENTRY_DSN, APP_VERSION_CODE} from '../config';

/** True when Sentry should run: a DSN is set and this is not a dev build. */
export const isSentryEnabled = SENTRY_DSN !== '' && !__DEV__;

export function initSentry(): void {
  if (!isSentryEnabled) {
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    release: `miflo@${APP_VERSION_CODE}`,
    // Crash/error reporting only — no performance or profiling for v1.
    tracesSampleRate: 0,
    // Never attach IP address, device id, nicknames, or other PII.
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      return event;
    },
  });
}

export {Sentry};
