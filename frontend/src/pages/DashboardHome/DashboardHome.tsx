import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { OrderStatus, Restaurant, Role } from "../../lib/types";
import DashboardCards from "../../ported/dashboard/DashboardCards";

export interface RecentDashboardOrder {
  id: string;
  tableNumber: number | null;
  status: OrderStatus;
  total: number;
  paid: boolean;
  createdAt: string;
}

interface Summary {
  todayRevenue: number;
  todayPaidCount: number;
  pendingCount: number;
  readyCount: number;
  servedCount: number;
  cancelledCount: number;
  unpaidTableCount: number;
  unpaidTotal: number;
  callCount: number;
  menuCount: number;
  availableMenuCount: number;
  unavailableMenuCount: number;
  categoryCount: number;
  tableCount: number;
  openTableCount: number;
  closedTableCount: number;
  activePromotionCount: number;
  scheduledPromotionCount: number;
  recentOrders: RecentDashboardOrder[];
}

const emptySummary: Summary = {
  todayRevenue: 0,
  todayPaidCount: 0,
  pendingCount: 0,
  readyCount: 0,
  servedCount: 0,
  cancelledCount: 0,
  unpaidTableCount: 0,
  unpaidTotal: 0,
  callCount: 0,
  menuCount: 0,
  availableMenuCount: 0,
  unavailableMenuCount: 0,
  categoryCount: 0,
  tableCount: 0,
  openTableCount: 0,
  closedTableCount: 0,
  activePromotionCount: 0,
  scheduledPromotionCount: 0,
  recentOrders: [],
};

export function DashboardHome({
  restaurant,
  role,
}: {
  restaurant: Restaurant | null;
  role: Role;
}) {
  const [summary, setSummary] = useState<Summary>(emptySummary);

  useEffect(() => {
    if (!restaurant) return;
    void loadSummary(restaurant.id).then(setSummary);
  }, [restaurant]);

  return <DashboardCards restaurant={restaurant} role={role} {...summary} />;
}

async function loadSummary(restaurantId: string): Promise<Summary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.toISOString();

  const [orders, menus, tables, categories, promotions, calls] = await Promise.all([
    supabase()
      .from("orders")
      .select("id, total, paid, table_id, status, created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    supabase().from("menus").select("id, available").eq("restaurant_id", restaurantId),
    supabase().from("tables").select("id, table_number, is_open").eq("restaurant_id", restaurantId),
    supabase().from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    supabase()
      .from("promotions")
      .select("id, active, start_at, end_at")
      .eq("restaurant_id", restaurantId),
    supabase()
      .from("call_staff_requests")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("acknowledged", false),
  ]);

  const rows = (orders.data ?? []) as Array<{
    id: string;
    total: number;
    paid: boolean;
    table_id: string;
    status: OrderStatus;
    created_at: string;
  }>;
  const menuRows = (menus.data ?? []) as Array<{ id: string; available: boolean }>;
  const tableRows = (tables.data ?? []) as Array<{ id: string; table_number: number; is_open: boolean }>;
  const promotionRows = (promotions.data ?? []) as Array<{
    id: string;
    active: boolean;
    start_at: string | null;
    end_at: string | null;
  }>;
  const tableById = new Map(tableRows.map((table) => [table.id, table]));
  const now = Date.now();
  const paidRows = rows.filter((order) => order.paid);
  const unpaidRows = rows.filter((order) => !order.paid);
  const openTableCount = tableRows.filter((table) => table.is_open).length;

  return {
    todayRevenue: paidRows.reduce((sum, order) => sum + Number(order.total), 0),
    todayPaidCount: paidRows.length,
    pendingCount: rows.filter((order) => order.status === "pending").length,
    readyCount: rows.filter((order) => order.status === "ready").length,
    servedCount: rows.filter((order) => order.status === "served").length,
    cancelledCount: rows.filter((order) => order.status === "cancelled").length,
    unpaidTableCount: new Set(unpaidRows.map((order) => order.table_id)).size,
    unpaidTotal: unpaidRows.reduce((sum, order) => sum + Number(order.total), 0),
    callCount: calls.count ?? 0,
    menuCount: menuRows.length,
    availableMenuCount: menuRows.filter((menu) => menu.available).length,
    unavailableMenuCount: menuRows.filter((menu) => !menu.available).length,
    categoryCount: categories.count ?? 0,
    tableCount: tableRows.length,
    openTableCount,
    closedTableCount: tableRows.length - openTableCount,
    activePromotionCount: promotionRows.filter((promotion) => {
      if (!promotion.active) return false;
      const startsOk = !promotion.start_at || +new Date(promotion.start_at) <= now;
      const endsOk = !promotion.end_at || +new Date(promotion.end_at) >= now;
      return startsOk && endsOk;
    }).length,
    scheduledPromotionCount: promotionRows.filter(
      (promotion) => promotion.active && promotion.start_at && +new Date(promotion.start_at) > now,
    ).length,
    recentOrders: rows.slice(0, 6).map((order) => ({
      id: order.id,
      tableNumber: tableById.get(order.table_id)?.table_number ?? null,
      status: order.status,
      total: Number(order.total),
      paid: order.paid,
      createdAt: order.created_at,
    })),
  };
}
