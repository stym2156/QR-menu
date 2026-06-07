import { useEffect, useState } from "react";
import {
  CATEGORY_SELECT,
  MENU_SELECT,
  ORDER_SELECT,
  TABLE_SELECT,
  TABLE_ZONE_SELECT,
} from "../lib/db/selects";
import { supabase } from "../lib/supabase";
import type { Category, DiningTable, Menu, Order, TableZone } from "../lib/types";
import StatsView from "../ported/dashboard/stats/StatsView";

interface StatsData {
  orders: Order[];
  menus: Menu[];
  categories: Category[];
  tables: DiningTable[];
  zones: TableZone[];
}

export function StatsPage({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const client = supabase();
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const [orders, menus, categories, tables, zones] = await Promise.all([
        client
          .from("orders")
          .select(ORDER_SELECT)
          .eq("restaurant_id", restaurantId)
          .eq("paid", true)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false }),
        client.from("menus").select(MENU_SELECT).eq("restaurant_id", restaurantId),
        client
          .from("categories")
          .select(CATEGORY_SELECT)
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: true }),
        client.from("tables").select(TABLE_SELECT).eq("restaurant_id", restaurantId),
        client
          .from("table_zones")
          .select(TABLE_ZONE_SELECT)
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;
      setData({
        orders: (orders.data ?? []) as Order[],
        menus: (menus.data ?? []) as Menu[],
        categories: (categories.data ?? []) as Category[],
        tables: (tables.data ?? []) as DiningTable[],
        zones: (zones.data ?? []) as TableZone[],
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
        Loading stats...
      </div>
    );
  }

  return (
    <StatsView
      orders={data.orders}
      menus={data.menus}
      categories={data.categories}
      tables={data.tables}
      zones={data.zones}
    />
  );
}
