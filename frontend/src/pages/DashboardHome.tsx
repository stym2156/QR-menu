import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Restaurant } from "../lib/types";
import DashboardCards from "../ported/dashboard/DashboardCards";

interface Summary {
  todayRevenue: number;
  todayPaidCount: number;
  pendingCount: number;
  unpaidTableCount: number;
  unpaidTotal: number;
  callCount: number;
  menuCount: number;
  tableCount: number;
}

const emptySummary: Summary = {
  todayRevenue: 0,
  todayPaidCount: 0,
  pendingCount: 0,
  unpaidTableCount: 0,
  unpaidTotal: 0,
  callCount: 0,
  menuCount: 0,
  tableCount: 0,
};

export function DashboardHome({ restaurant }: { restaurant: Restaurant | null }) {
  const [summary, setSummary] = useState<Summary>(emptySummary);

  useEffect(() => {
    if (!restaurant) return;
    void loadSummary(restaurant.id).then(setSummary);
  }, [restaurant]);

  return <DashboardCards {...summary} />;
}

async function loadSummary(restaurantId: string): Promise<Summary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.toISOString();

  const [orders, menus, tables, calls] = await Promise.all([
    supabase()
      .from("orders")
      .select("total, paid, table_id, status")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since),
    supabase().from("menus").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    supabase().from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    supabase()
      .from("call_staff_requests")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("acknowledged", false),
  ]);

  const rows = (orders.data ?? []) as Array<{
    total: number;
    paid: boolean;
    table_id: string;
    status: string;
  }>;
  const paidRows = rows.filter((order) => order.paid);
  const unpaidRows = rows.filter((order) => !order.paid);

  return {
    todayRevenue: paidRows.reduce((sum, order) => sum + Number(order.total), 0),
    todayPaidCount: paidRows.length,
    pendingCount: rows.filter((order) => order.status === "pending").length,
    unpaidTableCount: new Set(unpaidRows.map((order) => order.table_id)).size,
    unpaidTotal: unpaidRows.reduce((sum, order) => sum + Number(order.total), 0),
    callCount: calls.count ?? 0,
    menuCount: menus.count ?? 0,
    tableCount: tables.count ?? 0,
  };
}
