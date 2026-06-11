import { useEffect, useState } from "react";
import I18nPageHeader from "../../components/I18nPageHeader";
import {
  MENU_SELECT,
  ORDER_SELECT,
  TABLE_SELECT,
  TABLE_ZONE_SELECT,
} from "../../lib/db/selects";
import { supabase } from "../../lib/supabase";
import type { DiningTable, Menu, Order, Role, TableZone } from "../../lib/types";
import KitchenDisplay from "../../ported/dashboard/kitchen/KitchenDisplay";

interface KitchenData {
  orders: Order[];
  history: Order[];
  menus: Menu[];
  tables: DiningTable[];
  zones: TableZone[];
  memberEmails: Record<string, string>;
  kitchenPrintWidth: number;
}

export function KitchenPage({
  restaurantId,
  role,
}: {
  restaurantId: string;
  role: Role;
}) {
  const [data, setData] = useState<KitchenData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const client = supabase();
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const [orders, history, menus, tables, zones, members, restaurantRow] =
        await Promise.all([
          client
            .from("orders")
            .select(ORDER_SELECT)
            .eq("restaurant_id", restaurantId)
            .in("status", ["pending", "ready"])
            .order("created_at", { ascending: true }),
          client
            .from("orders")
            .select(ORDER_SELECT)
            .eq("restaurant_id", restaurantId)
            .in("status", ["served", "cancelled"])
            .gte("completed_at", since.toISOString())
            .order("completed_at", { ascending: false })
            .limit(100),
          client.from("menus").select(MENU_SELECT).eq("restaurant_id", restaurantId),
          client.from("tables").select(TABLE_SELECT).eq("restaurant_id", restaurantId),
          client
            .from("table_zones")
            .select(TABLE_ZONE_SELECT)
            .eq("restaurant_id", restaurantId)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          client.rpc("lookup_member_emails", { rid: restaurantId }),
          client
            .from("restaurants")
            .select("kitchen_print_width")
            .eq("id", restaurantId)
            .maybeSingle(),
        ]);

      if (cancelled) return;
      const memberEmails: Record<string, string> = {};
      for (const member of (members.data ?? []) as Array<{ user_id: string; email: string }>) {
        memberEmails[member.user_id] = member.email;
      }
      setData({
        orders: (orders.data ?? []) as Order[],
        history: (history.data ?? []) as Order[],
        menus: (menus.data ?? []) as Menu[],
        tables: (tables.data ?? []) as DiningTable[],
        zones: (zones.data ?? []) as TableZone[],
        memberEmails,
        kitchenPrintWidth:
          (restaurantRow.data as { kitchen_print_width?: number } | null)?.kitchen_print_width ?? 58,
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const canAct = role === "owner" || role === "cook" || role === "staff";

  return (
    <div>
      <I18nPageHeader titleKey="page.kitchen.title" descKey="page.kitchen.desc" />
      {data ? (
        <KitchenDisplay
          restaurantId={restaurantId}
          initialOrders={data.orders}
          initialHistory={data.history}
          menus={data.menus}
          tables={data.tables}
          zones={data.zones}
          memberEmails={data.memberEmails}
          canAct={canAct}
          kitchenPrintWidth={data.kitchenPrintWidth}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
          Loading kitchen...
        </div>
      )}
    </div>
  );
}

