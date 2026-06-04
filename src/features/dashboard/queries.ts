import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardSummary {
  todayRevenue: number;
  todayPaidCount: number;
  pendingCount: number;
  unpaidTableCount: number;
  unpaidTotal: number;
  callCount: number;
  menuCount: number;
  tableCount: number;
}

export async function getDashboardSummary(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<DashboardSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: menuCount },
    { count: tableCount },
    { count: pendingCount },
    { count: callCount },
    { data: todayPaid },
    { data: unpaidOrders },
  ] = await Promise.all([
    supabase
      .from("menus")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending"),
    supabase
      .from("call_staff_requests")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("acknowledged", false),
    supabase
      .from("orders")
      .select("total")
      .eq("restaurant_id", restaurantId)
      .eq("paid", true)
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("table_id, total")
      .eq("restaurant_id", restaurantId)
      .eq("paid", false),
  ]);

  return {
    todayRevenue: (todayPaid ?? []).reduce(
      (sum, order) => sum + Number(order.total),
      0,
    ),
    todayPaidCount: todayPaid?.length ?? 0,
    pendingCount: pendingCount ?? 0,
    unpaidTableCount: new Set((unpaidOrders ?? []).map((o) => o.table_id)).size,
    unpaidTotal: (unpaidOrders ?? []).reduce(
      (sum, order) => sum + Number(order.total),
      0,
    ),
    callCount: callCount ?? 0,
    menuCount: menuCount ?? 0,
    tableCount: tableCount ?? 0,
  };
}
