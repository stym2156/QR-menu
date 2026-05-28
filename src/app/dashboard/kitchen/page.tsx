import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canActKitchen, canSeeKitchen, getCurrentMembership } from "@/lib/membership";
import KitchenDisplay from "./KitchenDisplay";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { DiningTable, Menu, Order, TableZone } from "@/lib/types";

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
  if (!canSeeKitchen(membership.role)) redirect("/dashboard");
  const restaurant = { id: membership.restaurantId };

  // Pull 7-day completion history window. Older than that lives on /stats.
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [
    { data: orders },
    { data: history },
    { data: menus },
    { data: tables },
    { data: zones },
    { data: members },
    { data: restaurantRow },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["pending", "ready"])
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["served", "cancelled"])
      .gte("completed_at", since.toISOString())
      .order("completed_at", { ascending: false })
      .limit(100),
    supabase.from("menus").select("*").eq("restaurant_id", restaurant.id),
    supabase.from("tables").select("*").eq("restaurant_id", restaurant.id),
    supabase
      .from("table_zones")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.rpc("lookup_member_emails", { rid: restaurant.id }),
    supabase
      .from("restaurants")
      .select("name, kitchen_print_width")
      .eq("id", restaurant.id)
      .maybeSingle(),
  ]);

  const memberEmails: Record<string, string> = {};
  for (const m of (members ?? []) as Array<{ user_id: string; email: string }>) {
    memberEmails[m.user_id] = m.email;
  }

  return (
    <div>
      <I18nPageHeader titleKey="page.kitchen.title" descKey="page.kitchen.desc" />
      <KitchenDisplay
        restaurantId={restaurant.id}
        initialOrders={(orders ?? []) as Order[]}
        initialHistory={(history ?? []) as Order[]}
        menus={(menus ?? []) as Menu[]}
        tables={(tables ?? []) as DiningTable[]}
        zones={(zones ?? []) as TableZone[]}
        memberEmails={memberEmails}
        canAct={canActKitchen(membership.role)}
        kitchenPrintWidth={
          (restaurantRow as { kitchen_print_width?: number } | null)
            ?.kitchen_print_width ?? 58
        }
      />
    </div>
  );
}
