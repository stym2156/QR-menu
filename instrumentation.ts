// Next.js instrumentation hook — runs once per runtime before any other
// code. Loads the right Sentry config based on which runtime is active.
// Required by @sentry/nextjs for server + edge initialization in
// Next 15+ (the old `sentry.server.config.ts` auto-load was removed).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
