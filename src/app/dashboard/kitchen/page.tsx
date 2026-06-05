import { redirect } from "next/navigation";
import { canActKitchen, canSeeKitchen } from "@/lib/membership";
import {
  MENU_SELECT,
  ORDER_SELECT,
  TABLE_SELECT,
  TABLE_ZONE_SELECT,
} from "@/lib/db/selects";
import { requireDashboardSession } from "@/server/auth";
import KitchenDisplay from "./KitchenDisplay";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { DiningTable, Menu, Order, TableZone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const { supabase, membership } = await requireDashboardSession();
  if (!canSeeKitchen(membership.role)) redirect("/dashboard");

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
      .select(ORDER_SELECT)
      .eq("restaurant_id", membership.restaurantId)
      .in("status", ["pending", "ready"])
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("restaurant_id", membership.restaurantId)
      .in("status", ["served", "cancelled"])
      .gte("completed_at", since.toISOString())
      .order("completed_at", { ascending: false })
      .limit(100),
    supabase.from("menus").select(MENU_SELECT).eq("restaurant_id", membership.restaurantId),
    supabase.from("tables").select(TABLE_SELECT).eq("restaurant_id", membership.restaurantId),
    supabase
      .from("table_zones")
      .select(TABLE_ZONE_SELECT)
      .eq("restaurant_id", membership.restaurantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.rpc("lookup_member_emails", { rid: membership.restaurantId }),
    supabase
      .from("restaurants")
      .select("name, kitchen_print_width")
      .eq("id", membership.restaurantId)
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
        restaurantId={membership.restaurantId}
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
