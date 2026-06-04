import { redirect } from "next/navigation";
import { isOwner } from "@/lib/membership";
import { requireDashboardSession } from "@/server/auth";
import StatsView from "./StatsView";
import type { Category, DiningTable, Menu, Order, TableZone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { supabase, membership } = await requireDashboardSession();
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
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .eq("paid", true)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("menus").select("*").eq("restaurant_id", membership.restaurantId),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .order("sort_order", { ascending: true }),
    supabase.from("tables").select("*").eq("restaurant_id", membership.restaurantId),
    supabase
      .from("table_zones")
      .select("*")
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
