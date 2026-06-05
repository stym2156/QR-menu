import { redirect } from "next/navigation";
import {
  CATEGORY_SELECT,
  MENU_SELECT,
  PROMOTION_SELECT,
  RESTAURANT_SELECT,
  TABLE_SELECT,
} from "@/lib/db/selects";
import { canSeeMenu, isOwner } from "@/lib/membership";
import { getShopStatus } from "@/lib/hours";
import { requireDashboardSession } from "@/server/auth";
import MenuManager from "./MenuManager";
import MenuPageHeaderClient from "./MenuPageHeaderClient";
import StaffOrderHelper from "./StaffOrderHelper";
import type {
  Category,
  DiningTable,
  Menu,
  Promotion,
  Restaurant,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { supabase, membership } = await requireDashboardSession();
  if (!canSeeMenu(membership.role)) redirect("/dashboard");

  const role = membership.role;
  const isStaff = !isOwner(role);

  // Always fetch menus + categories. Staff view additionally needs tables,
  // promotions, and the restaurant settings to drive the customer-style
  // ordering UI.
  const [{ data: menus }, { data: categories }, restaurantRes, tablesRes, promotionsRes] =
    await Promise.all([
      supabase
        .from("menus")
        .select(MENU_SELECT)
        .eq("restaurant_id", membership.restaurantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select(CATEGORY_SELECT)
        .eq("restaurant_id", membership.restaurantId)
        .order("sort_order", { ascending: true }),
      isStaff
        ? supabase
            .from("restaurants")
            .select(RESTAURANT_SELECT)
            .eq("id", membership.restaurantId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      isStaff
        ? supabase
            .from("tables")
            .select(TABLE_SELECT)
            .eq("restaurant_id", membership.restaurantId)
            .order("table_number", { ascending: true })
        : Promise.resolve({ data: null }),
      isStaff
        ? supabase
            .from("promotions")
            .select(PROMOTION_SELECT)
            .eq("restaurant_id", membership.restaurantId)
            .eq("active", true)
        : Promise.resolve({ data: null }),
    ]);

  if (isStaff) {
    const restaurant = restaurantRes.data as Restaurant | null;
    const shopStatus = restaurant
      ? getShopStatus({
          accepting_orders: restaurant.accepting_orders ?? true,
          open_time: restaurant.open_time ?? null,
          close_time: restaurant.close_time ?? null,
        })
      : { isOpen: true };

    return (
      <div>
        <MenuPageHeaderClient />
        <StaffOrderHelper
          restaurantId={membership.restaurantId}
          tables={(tablesRes.data ?? []) as DiningTable[]}
          menus={(menus ?? []) as Menu[]}
          categories={(categories ?? []) as Category[]}
          promotions={(promotionsRes.data ?? []) as Promotion[]}
          shopOpen={shopStatus.isOpen}
          serviceChargePct={Number(restaurant?.service_charge_pct) || 0}
          vatPct={Number(restaurant?.vat_pct) || 0}
        />
      </div>
    );
  }

  return (
    <div>
      <MenuPageHeaderClient />
      <MenuManager
        restaurantId={membership.restaurantId}
        initialMenus={(menus ?? []) as Menu[]}
        categories={(categories ?? []) as Category[]}
        canAct={true}
      />
    </div>
  );
}
