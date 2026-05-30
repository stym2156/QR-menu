import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerOrder from "./CustomerOrder";
import CustomerHeader from "./CustomerHeader";
import { getShopStatus } from "@/lib/hours";
import type { Category, Menu, Promotion } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ restaurantId: string; tableId: string }>;

export default async function CustomerMenuPage({ params }: { params: Params }) {
  const { restaurantId, tableId } = await params;
  const supabase = await createClient();

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
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("available", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("promotions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .or(`start_at.is.null,start_at.lte.${new Date().toISOString()}`)
      .or(`end_at.is.null,end_at.gte.${new Date().toISOString()}`)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (!table || !restaurant) notFound();

  const tableIsOpen = (table as { is_open?: boolean }).is_open ?? false;
  const zoneName =
    (table as { table_zones?: { name?: string } | { name?: string }[] | null })
      .table_zones instanceof Array
      ? (table as { table_zones?: { name?: string }[] }).table_zones?.[0]?.name ?? null
      : (table as { table_zones?: { name?: string } | null }).table_zones?.name ?? null;
  const shopStatus = getShopStatus({
    accepting_orders: restaurant.accepting_orders ?? true,
    open_time: restaurant.open_time ?? null,
    close_time: restaurant.close_time ?? null,
  });
  const canOrder = shopStatus.isOpen && tableIsOpen;

  return (
    <main className="min-h-screen bg-canvas pb-36">
      <CustomerHeader
        restaurantName={restaurant.name}
        tableNumber={table.table_number}
        zoneName={zoneName}
        shopIsOpen={shopStatus.isOpen}
        openTime={shopStatus.openTime ?? null}
        closeTime={shopStatus.closeTime ?? null}
        closedReason={
          shopStatus.reason === "manually_closed" ? "manually_closed" : null
        }
        tableIsOpen={tableIsOpen}
      />

      <CustomerOrder
        restaurantId={restaurantId}
        tableId={tableId}
        tableNumber={table.table_number}
        menus={(menus ?? []) as Menu[]}
        categories={(categories ?? []) as Category[]}
        promotions={(promotions ?? []) as Promotion[]}
        shopOpen={canOrder}
        serviceChargePct={Number(restaurant.service_charge_pct) || 0}
        vatPct={Number(restaurant.vat_pct) || 0}
      />
    </main>
  );
}
