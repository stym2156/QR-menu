import { createBrowserClient } from "@supabase/ssr";
import { env } from "../env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  return browserClient;
}
