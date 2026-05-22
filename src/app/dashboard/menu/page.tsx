import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership, isOwner } from "@/lib/membership";
import MenuManager from "./MenuManager";
import MenuPageHeaderClient from "./MenuPageHeaderClient";
import type { Category, Menu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
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

  const [{ data: menus }, { data: categories }] = await Promise.all([
    supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      <MenuPageHeaderClient />
      <MenuManager
        restaurantId={membership.restaurantId}
        initialMenus={(menus ?? []) as Menu[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
