import { useEffect, useState } from "react";
import I18nPageHeader from "../components/I18nPageHeader";
import {
  CALL_STAFF_SELECT,
  MENU_SELECT,
  ORDER_SELECT,
  TABLE_SELECT,
  TABLE_ZONE_SELECT,
} from "../lib/db/selects";
import { supabase } from "../lib/supabase";
import type { CallStaffRequest, DiningTable, Menu, Order, Role, TableZone } from "../lib/types";
import BillsView from "../ported/dashboard/bills/BillsView";

interface BillsData {
  restaurantName: string;
  serviceChargePct: number;
  vatPct: number;
  paymentQrUrl: string | null;
  orders: Order[];
  settledOrders: Order[];
  tables: DiningTable[];
  zones: TableZone[];
  menus: Menu[];
  calls: CallStaffRequest[];
}

export function BillsPage({
  restaurantId,
  role,
}: {
  restaurantId: string;
  role: Role;
}) {
  const [data, setData] = useState<BillsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const client = supabase();
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const [restaurant, orders, settledOrders, tables, zones, menus, calls] =
        await Promise.all([
          client
            .from("restaurants")
            .select("id, name, service_charge_pct, vat_pct, payment_qr_url")
            .eq("id", restaurantId)
            .maybeSingle(),
          client
            .from("orders")
            .select(ORDER_SELECT)
            .eq("restaurant_id", restaurantId)
            .eq("paid", false)
            .neq("status", "cancelled")
            .order("created_at", { ascending: true }),
          client
            .from("orders")
            .select(ORDER_SELECT)
            .eq("restaurant_id", restaurantId)
            .eq("paid", true)
            .gte("paid_at", since.toISOString())
            .order("paid_at", { ascending: false }),
          client
            .from("tables")
            .select(TABLE_SELECT)
            .eq("restaurant_id", restaurantId)
            .order("table_number", { ascending: true }),
          client
            .from("table_zones")
            .select(TABLE_ZONE_SELECT)
            .eq("restaurant_id", restaurantId)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          client.from("menus").select(MENU_SELECT).eq("restaurant_id", restaurantId),
          client
            .from("call_staff_requests")
            .select(CALL_STAFF_SELECT)
            .eq("restaurant_id", restaurantId)
            .eq("acknowledged", false)
            .order("created_at", { ascending: true }),
        ]);

      if (cancelled || !restaurant.data) return;
      const row = restaurant.data as {
        name: string;
        service_charge_pct: number | string | null;
        vat_pct: number | string | null;
        payment_qr_url: string | null;
      };
      setData({
        restaurantName: row.name,
        serviceChargePct: Number(row.service_charge_pct) || 0,
        vatPct: Number(row.vat_pct) || 0,
        paymentQrUrl: row.payment_qr_url ?? null,
        orders: (orders.data ?? []) as Order[],
        settledOrders: (settledOrders.data ?? []) as Order[],
        tables: (tables.data ?? []) as DiningTable[],
        zones: (zones.data ?? []) as TableZone[],
        menus: (menus.data ?? []) as Menu[],
        calls: (calls.data ?? []) as CallStaffRequest[],
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const canAct = role === "owner" || role === "waiter" || role === "staff";

  return (
    <div>
      <I18nPageHeader titleKey="page.bills.title" descKey="page.bills.desc" />
      {data ? (
        <BillsView
          restaurantId={restaurantId}
          restaurantName={data.restaurantName}
          serviceChargePct={data.serviceChargePct}
          vatPct={data.vatPct}
          paymentQrUrl={data.paymentQrUrl}
          initialOrders={data.orders}
          initialSettledOrders={data.settledOrders}
          tables={data.tables}
          zones={data.zones}
          menus={data.menus}
          initialCalls={data.calls}
          canAct={canAct}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
          Loading bills...
        </div>
      )}
    </div>
  );
}
