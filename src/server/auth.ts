import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentMembership,
  type Membership,
  type RestaurantRole,
} from "@/lib/membership";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface DashboardSession {
  supabase: SupabaseServerClient;
  user: NonNullable<
    Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"]
  >;
  membership: Membership;
}

interface RequireDashboardSessionOptions {
  allow?: (role: RestaurantRole) => boolean;
  redirectTo?: string;
}

export async function getDashboardSession(): Promise<DashboardSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership) return null;

  return { supabase, user, membership };
}

export async function requireDashboardSession(
  options: RequireDashboardSessionOptions = {},
): Promise<DashboardSession> {
  const session = await getDashboardSession();
  if (!session) redirect(options.redirectTo ?? "/login");

  if (options.allow && !options.allow(session.membership.role)) {
    redirect(options.redirectTo ?? "/dashboard");
  }

  return session;
}
