import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BackendEnv } from "../config/env";

export interface SupabaseClients {
  anon: SupabaseClient;
  admin: SupabaseClient | null;
}

export function createSupabaseClients(env: BackendEnv): SupabaseClients {
  return {
    anon: createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    }),
    admin: env.supabaseServiceRoleKey
      ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
          auth: { persistSession: false },
        })
      : null,
  };
}
