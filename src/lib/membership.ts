// Resolve the current authenticated user's restaurant membership.
// Returns { restaurantId, role } so pages don't have to repeat the lookup.

import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantRole = "owner" | "staff";

export interface Membership {
  restaurantId: string;
  role: RestaurantRole;
}

export async function getCurrentMembership(
  supabase: SupabaseClient,
): Promise<Membership | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    restaurantId: data.restaurant_id as string,
    role: data.role as RestaurantRole,
  };
}
