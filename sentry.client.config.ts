// Client-side Sentry config. Loaded by @sentry/nextjs in the browser.
// DSN comes from NEXT_PUBLIC_SENTRY_DSN — if absent, Sentry no-ops cleanly,
// so dev/local builds aren't required to wire up an account.
//
// Setup: create a project at https://sentry.io/ and copy the DSN into
// .env.local (or Vercel env). No restart needed for Vercel — just redeploy.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample only a slice of traces — restaurant traffic is bursty and we
    // care more about errors than profiling. Tune up if you need traces.
    tracesSampleRate: 0.1,
    // Replay sessions when an error fires — invaluable for "the cook said
    // the print button does nothing" tickets where you can't reproduce.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    // Strip noise from third-party browser extensions, etc.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ],
  });
}
