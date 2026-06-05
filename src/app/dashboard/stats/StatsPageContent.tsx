import { redirect } from "next/navigation";
import {
  CATEGORY_SELECT,
  MENU_SELECT,
  ORDER_SELECT,
  TABLE_SELECT,
  TABLE_ZONE_SELECT,
} from "@/lib/db/selects";
import { isOwner } from "@/lib/membership";
import { requireDashboardSession, type DashboardSession } from "@/server/auth";
import StatsView from "./StatsView";
import type { Category, DiningTable, Menu, Order, TableZone } from "@/lib/types";

export async function StatsPageContent({
  session,
}: {
  session?: DashboardSession;
} = {}) {
  const { supabase, membership } = session ?? (await requireDashboardSession());
  if (!isOwner(membership.role)) redirect("/dashboard");

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    { data: orders },
    { data: menus },
    { data: categories },
    { data: tables },
    { data: zones },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("restaurant_id", membership.restaurantId)
      .eq("paid", true)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("menus").select(MENU_SELECT).eq("restaurant_id", membership.restaurantId),
    supabase
      .from("categories")
      .select(CATEGORY_SELECT)
      .eq("restaurant_id", membership.restaurantId)
      .order("sort_order", { ascending: true }),
    supabase.from("tables").select(TABLE_SELECT).eq("restaurant_id", membership.restaurantId),
    supabase
      .from("table_zones")
      .select(TABLE_ZONE_SELECT)
      .eq("restaurant_id", membership.restaurantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  return (
    <div>
      <StatsView
        orders={(orders ?? []) as Order[]}
        menus={(menus ?? []) as Menu[]}
        categories={(categories ?? []) as Category[]}
        tables={(tables ?? []) as DiningTable[]}
        zones={(zones ?? []) as TableZone[]}
      />
    </div>
  );
}
