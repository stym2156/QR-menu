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

// Server-side guard for /admin/(authed)/* routes. Redirects to the dedicated
// /admin/login page in both cases — signed-out and signed-in-but-not-admin.
// If a non-admin user is signed in, we don't sign them out here (we don't
// have a writable session in a server component); the login page will reject
// them and call signOut on re-attempt.
export async function requireAdmin(supabase: SupabaseClient): Promise<{
  userId: string;
  email: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) redirect("/admin/login");
  return { userId: user.id, email: user.email ?? null };
}
