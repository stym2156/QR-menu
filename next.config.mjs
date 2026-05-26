import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

// Sentry config is no-op when env vars are missing — safe to leave wrapped
// even when not actively using Sentry. Set SENTRY_AUTH_TOKEN + SENTRY_ORG
// + SENTRY_PROJECT in Vercel to enable source-map upload for stack traces.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Hide source maps from production bundles (still uploaded to Sentry).
  hideSourceMaps: true,
  // Tunnel through a Next.js route to bypass ad blockers killing reports.
  tunnelRoute: "/monitoring",
});
