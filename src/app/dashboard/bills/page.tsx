import { redirect } from "next/navigation";
import { canActBills, canSeeBills } from "@/lib/membership";
import {
  CALL_STAFF_SELECT,
  MENU_SELECT,
  ORDER_SELECT,
  TABLE_SELECT,
  TABLE_ZONE_SELECT,
} from "@/lib/db/selects";
import { requireDashboardSession } from "@/server/auth";
import BillsView from "./BillsView";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { CallStaffRequest, DiningTable, Menu, Order, TableZone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const { supabase, membership } = await requireDashboardSession();
  if (!canSeeBills(membership.role)) redirect("/dashboard");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, service_charge_pct, vat_pct, payment_qr_url")
    .eq("id", membership.restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return <p className="text-muted">ไม่พบข้อมูลร้าน</p>;
  }

  // Settled-bills history window - 30 days back is plenty for the bills view
  // (older history lives on the stats page).
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    { data: orders },
    { data: settledOrders },
    { data: tables },
    { data: zones },
    { data: menus },
    { data: calls },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("restaurant_id", restaurant.id)
      .eq("paid", false)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("restaurant_id", restaurant.id)
      .eq("paid", true)
      .gte("paid_at", since.toISOString())
      .order("paid_at", { ascending: false }),
    supabase
      .from("tables")
      .select(TABLE_SELECT)
      .eq("restaurant_id", restaurant.id)
      .order("table_number", { ascending: true }),
    supabase
      .from("table_zones")
      .select(TABLE_ZONE_SELECT)
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("menus").select(MENU_SELECT).eq("restaurant_id", restaurant.id),
    supabase
      .from("call_staff_requests")
      .select(CALL_STAFF_SELECT)
      .eq("restaurant_id", restaurant.id)
      .eq("acknowledged", false)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div>
      <I18nPageHeader titleKey="page.bills.title" descKey="page.bills.desc" />
      <BillsView
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        serviceChargePct={Number(restaurant.service_charge_pct) || 0}
        vatPct={Number(restaurant.vat_pct) || 0}
        paymentQrUrl={restaurant.payment_qr_url ?? null}
        initialOrders={(orders ?? []) as Order[]}
        initialSettledOrders={(settledOrders ?? []) as Order[]}
        tables={(tables ?? []) as DiningTable[]}
        zones={(zones ?? []) as TableZone[]}
        menus={(menus ?? []) as Menu[]}
        initialCalls={(calls ?? []) as CallStaffRequest[]}
        canAct={canActBills(membership.role)}
      />
    </div>
  );
}
