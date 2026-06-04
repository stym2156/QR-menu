// Resolve the current authenticated user's restaurant membership.
// Returns { restaurantId, role } so pages don't have to repeat the lookup.

import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantRole = "owner" | "staff" | "cook" | "waiter";

// =============================================================
// VIEW access — who can navigate to and read the page.
// Cross-role visibility: cook+waiter can see each other's pages
// in read-only mode so they understand the full restaurant state.
// =============================================================
export function canSeeKitchen(role: RestaurantRole): boolean {
  return (
    role === "owner" ||
    role === "cook" ||
    role === "waiter" ||
    role === "staff"
  );
}

export function canSeeBills(role: RestaurantRole): boolean {
  return (
    role === "owner" ||
    role === "cook" ||
    role === "waiter" ||
    role === "staff"
  );
}

export function canSeeTables(role: RestaurantRole): boolean {
  return role === "owner" || role === "cook" || role === "waiter";
}

// =============================================================
// ACT access — who can perform actions (mutate state) on the page.
// Roles that can SEE but not ACT get a read-only UI.
// =============================================================
export function canActKitchen(role: RestaurantRole): boolean {
  return role === "owner" || role === "cook" || role === "staff";
}

export function canActBills(role: RestaurantRole): boolean {
  return role === "owner" || role === "waiter" || role === "staff";
}

// Open/close + add/delete on tables — owner + waiter.
// Cook can view but cannot toggle/add/delete.
export function canActTables(role: RestaurantRole): boolean {
  return role === "owner" || role === "waiter";
}

// Add/delete tables — owner only.
export function canManageTables(role: RestaurantRole): boolean {
  return role === "owner";
}

// Read-only menu list — owners manage, waiters/cooks browse it (e.g. to show
// the menu to a customer whose phone can't scan the QR code).
export function canSeeMenu(role: RestaurantRole): boolean {
  return (
    role === "owner" ||
    role === "cook" ||
    role === "waiter" ||
    role === "staff"
  );
}

export function isOwner(role: RestaurantRole): boolean {
  return role === "owner";
}

export interface Membership {
  restaurantId: string;
  role: RestaurantRole;
}

export async function getCurrentMembership(
  supabase: SupabaseClient,
  userId?: string,
): Promise<Membership | null> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    resolvedUserId = user?.id;
  }
  if (!resolvedUserId) return null;

  const { data } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", resolvedUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    restaurantId: data.restaurant_id as string,
    role: data.role as RestaurantRole,
  };
}
