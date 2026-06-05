import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_SELECT,
  MENU_SELECT,
  PROMOTION_SELECT,
} from "@/lib/db/selects";
import { getShopStatus } from "@/lib/hours";
import type { Category, Menu, Promotion } from "@/lib/types";

type CustomerTableRow = CustomerMenuData["table"];
type CustomerRestaurantRow = CustomerMenuData["restaurant"];

export interface CustomerMenuData {
  table: {
    id: string;
    table_number: number;
    restaurant_id: string;
    is_open?: boolean;
    zone_id?: string | null;
    table_zones?: { name?: string } | { name?: string }[] | null;
  };
  restaurant: {
    name: string;
    accepting_orders?: boolean | null;
    open_time?: string | null;
    close_time?: string | null;
    service_charge_pct?: number | string | null;
    vat_pct?: number | string | null;
  };
  menus: Menu[];
  categories: Category[];
  promotions: Promotion[];
  zoneName: string | null;
  shopIsOpen: boolean;
  canOrder: boolean;
  openTime: string | null;
  closeTime: string | null;
  closedReason: "manually_closed" | null;
}

export async function getCustomerMenuData(
  supabase: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<CustomerMenuData | null> {
  const nowIso = new Date().toISOString();
  const [
    { data: table },
    { data: restaurant },
    { data: menus },
    { data: categories },
    { data: promotions },
  ] = await Promise.all([
    supabase
      .from("tables")
      .select("id, table_number, restaurant_id, is_open, zone_id, table_zones(name)")
      .eq("id", tableId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    supabase
      .from("restaurants")
      .select("name, accepting_orders, open_time, close_time, service_charge_pct, vat_pct")
      .eq("id", restaurantId)
      .maybeSingle(),
    supabase
      .from("menus")
      .select(MENU_SELECT)
      .eq("restaurant_id", restaurantId)
      .eq("available", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select(CATEGORY_SELECT)
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("promotions")
      .select(PROMOTION_SELECT)
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .or(`start_at.is.null,start_at.lte.${nowIso}`)
      .or(`end_at.is.null,end_at.gte.${nowIso}`)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (!table || !restaurant) return null;

  const tableRow = table as CustomerTableRow;
  const restaurantRow = restaurant as CustomerRestaurantRow;
  const tableIsOpen = tableRow.is_open ?? false;
  const zoneName = Array.isArray(tableRow.table_zones)
    ? tableRow.table_zones[0]?.name ?? null
    : tableRow.table_zones?.name ?? null;
  const shopStatus = getShopStatus({
    accepting_orders: restaurantRow.accepting_orders ?? true,
    open_time: restaurantRow.open_time ?? null,
    close_time: restaurantRow.close_time ?? null,
  });

  return {
    table: tableRow,
    restaurant: restaurantRow,
    menus: (menus ?? []) as Menu[],
    categories: (categories ?? []) as Category[],
    promotions: (promotions ?? []) as Promotion[],
    zoneName,
    shopIsOpen: shopStatus.isOpen,
    canOrder: shopStatus.isOpen && tableIsOpen,
    openTime: shopStatus.openTime ?? null,
    closeTime: shopStatus.closeTime ?? null,
    closedReason:
      shopStatus.reason === "manually_closed" ? "manually_closed" : null,
  };
}
