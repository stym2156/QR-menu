import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership, isOwner } from "@/lib/membership";
import CloseShopView from "./CloseShopView";
import type { Menu, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CloseShopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return <NoShopMessage />;
  }
  if (!isOwner(membership.role)) redirect("/dashboard");

  // Default scope: orders from the last 14 days. Client narrows from there
  // (today / yesterday / custom range). 14 days keeps the worst-case
  // payload small while letting cooks who close shop late at night still
  // see "today" without a timezone-edge mismatch.
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [{ data: orders }, { data: menus }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .eq("paid", true)
      .gte("paid_at", since.toISOString())
      .order("paid_at", { ascending: false }),
    supabase.from("menus").select("*").eq("restaurant_id", membership.restaurantId),
  ]);

  return (
    <CloseShopView
      orders={(orders ?? []) as Order[]}
      menus={(menus ?? []) as Menu[]}
    />
  );
}
