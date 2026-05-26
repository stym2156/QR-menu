// Edge runtime Sentry (middleware, edge functions). Separate file so the
// edge bundle stays small — Node-only Sentry features aren't pulled in.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}
