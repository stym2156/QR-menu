// Validate required env vars lazily.
//
// IMPORTANT: Use literal property access (`process.env.NEXT_PUBLIC_FOO`),
// not dynamic (`process.env[name]`). Next.js / webpack only inlines the
// former into client bundles; the latter returns undefined in the browser.

function requireEnv(value: string | undefined, name: string): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. Set it in .env.local (dev) or your hosting provider (Vercel → Settings → Environment Variables).`,
    );
  }
  return value;
}

export const env = {
  get SUPABASE_URL(): string {
    return requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  },
  get SUPABASE_ANON_KEY(): string {
    return requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  },
};
