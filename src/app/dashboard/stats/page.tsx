import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership, isOwner } from "@/lib/membership";
import StatsView from "./StatsView";
import type { Category, Menu, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }
  if (!isOwner(membership.role)) redirect("/dashboard");

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: orders }, { data: menus }, { data: categories }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .eq("paid", true)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("menus").select("*").eq("restaurant_id", membership.restaurantId),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      <StatsView
        orders={(orders ?? []) as Order[]}
        menus={(menus ?? []) as Menu[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
