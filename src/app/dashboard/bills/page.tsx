import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import BillsView from "./BillsView";
import { PageHeader } from "@/components/ui";
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

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, service_charge_pct, vat_pct")
    .eq("id", membership.restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return <p className="text-muted">ไม่พบข้อมูลร้าน</p>;
  }

  const [{ data: orders }, { data: tables }, { data: menus }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("paid", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("table_number", { ascending: true }),
    supabase.from("menus").select("*").eq("restaurant_id", restaurant.id),
  ]);

  return (
    <div>
      <PageHeader
        title="เช็คบิล"
        description="คลิกที่โต๊ะเพื่อรับชำระทั้งบิลในคลิกเดียว"
      />
      <BillsView
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        serviceChargePct={Number(restaurant.service_charge_pct) || 0}
        vatPct={Number(restaurant.vat_pct) || 0}
        initialOrders={(orders ?? []) as Order[]}
        tables={(tables ?? []) as DiningTable[]}
        menus={(menus ?? []) as Menu[]}
      />
    </div>
  );
}
