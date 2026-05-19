import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import KitchenDisplay from "./KitchenDisplay";
import { PageHeader } from "@/components/ui";
import type { CallStaffRequest, DiningTable, Menu, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }
  const restaurant = { id: membership.restaurantId };

  const [{ data: orders }, { data: menus }, { data: tables }, { data: calls }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .in("status", ["pending", "ready"])
        .order("created_at", { ascending: true }),
      supabase.from("menus").select("*").eq("restaurant_id", restaurant.id),
      supabase.from("tables").select("*").eq("restaurant_id", restaurant.id),
      supabase
        .from("call_staff_requests")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("acknowledged", false)
        .order("created_at", { ascending: true }),
    ]);

  return (
    <div>
      <PageHeader
        title="ครัว"
        description="ออเดอร์เข้า realtime · เปิดเสียงไว้ตลอดเวลาทำงาน"
      />
      <KitchenDisplay
        restaurantId={restaurant.id}
        initialOrders={(orders ?? []) as Order[]}
        initialCalls={(calls ?? []) as CallStaffRequest[]}
        menus={(menus ?? []) as Menu[]}
        tables={(tables ?? []) as DiningTable[]}
      />
    </div>
  );
}
