import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { createClient } from "@/lib/supabase/server";
import { canSeeBills, getCurrentMembership } from "@/lib/membership";
import BillsView from "./BillsView";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { DiningTable, Menu, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }
  if (!canSeeBills(membership.role)) redirect("/dashboard");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, service_charge_pct, vat_pct, payment_qr_url")
    .eq("id", membership.restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return <p className="text-muted">ไม่พบข้อมูลร้าน</p>;
  }

  // Settled-bills history window — 30 days back is plenty for the bills view
  // (older history lives on the stats page).
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    { data: orders },
    { data: settledOrders },
    { data: tables },
    { data: menus },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("paid", false)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("paid", true)
      .gte("paid_at", since.toISOString())
      .order("paid_at", { ascending: false }),
    supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("table_number", { ascending: true }),
    supabase.from("menus").select("*").eq("restaurant_id", restaurant.id),
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
        menus={(menus ?? []) as Menu[]}
      />
    </div>
  );
}
