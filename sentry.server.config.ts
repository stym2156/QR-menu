// Server-side Sentry (Node runtime — API routes, server actions, RSC).
// DSN comes from SENTRY_DSN (server-only) which we keep separate from
// NEXT_PUBLIC_SENTRY_DSN so the server can use a different project if
// you ever want to split server vs client noise.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}
