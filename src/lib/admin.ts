import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

// Platform-admin check. Reads `public.app_admins` and returns true if the
// current authenticated user is listed there. The query is gated by RLS
// (only the row matching auth.uid() is visible), so this is safe to expose.
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

// Server-side guard for /admin/* routes. Redirects:
//   - not signed in           → /login
//   - signed in but not admin → /dashboard
export async function requireAdmin(supabase: SupabaseClient): Promise<{
  userId: string;
  email: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) redirect("/dashboard");
  return { userId: user.id, email: user.email ?? null };
}
