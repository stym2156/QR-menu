import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Category, DiningTable, Menu, Promotion, Restaurant, TableZone } from "../../lib/types";
import CustomerHeader from "../../ported/customer/menu/CustomerHeader";
import CustomerOrder from "../../ported/customer/menu/CustomerOrder";

interface CustomerMenuData {
  restaurant: Restaurant;
  table: DiningTable;
  zoneName: string | null;
  menus: Menu[];
  categories: Category[];
  promotions: Promotion[];
}

export function CustomerMenuPage({
  restaurantId,
  tableId,
  tableCode,
}: {
  restaurantId?: string;
  tableId?: string;
  tableCode?: string;
}) {
  const [data, setData] = useState<CustomerMenuData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const client = supabase();
      let resolvedRestaurantId = restaurantId ?? "";
      let resolvedTableId = tableId ?? "";

      if (tableCode) {
        const tableByCodeResult = await client
          .from("tables")
          .select("*")
          .eq("short_code", tableCode.toUpperCase())
          .maybeSingle();

        if (cancelled) return;
        const tableByCode = tableByCodeResult.data as DiningTable | null;
        if (!tableByCode) {
          setNotFound(true);
          return;
        }
        resolvedRestaurantId = tableByCode.restaurant_id;
        resolvedTableId = tableByCode.id;
      }

      if (!resolvedRestaurantId || !resolvedTableId) {
        setNotFound(true);
        return;
      }

      const [restaurantResult, tableResult, menuResult, categoryResult, promotionResult] =
        await Promise.all([
          client.from("restaurants").select("*").eq("id", resolvedRestaurantId).maybeSingle(),
          client.from("tables").select("*").eq("id", resolvedTableId).eq("restaurant_id", resolvedRestaurantId).maybeSingle(),
          client
            .from("menus")
            .select("*")
            .eq("restaurant_id", resolvedRestaurantId)
            .eq("available", true)
            .order("created_at", { ascending: false }),
          client.from("categories").select("*").eq("restaurant_id", resolvedRestaurantId).order("sort_order"),
          client
            .from("promotions")
            .select("*")
            .eq("restaurant_id", resolvedRestaurantId)
            .eq("active", true)
            .order("sort_order"),
        ]);

      if (cancelled) return;
      const restaurant = restaurantResult.data as Restaurant | null;
      const table = tableResult.data as DiningTable | null;
      if (!restaurant || !table) {
        setNotFound(true);
        return;
      }

      let zoneName: string | null = null;
      if (table.zone_id) {
        const zoneResult = await client
          .from("table_zones")
          .select("name")
          .eq("id", table.zone_id)
          .maybeSingle();
        if (!cancelled) zoneName = (zoneResult.data as Pick<TableZone, "name"> | null)?.name ?? null;
      }

      if (!cancelled) {
        setData({
          restaurant,
          table,
          zoneName,
          menus: (menuResult.data ?? []) as Menu[],
          categories: (categoryResult.data ?? []) as Category[],
          promotions: (promotionResult.data ?? []) as Promotion[],
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, tableId, tableCode]);

  const shopOpen = useMemo(() => {
    if (!data) return true;
    return data.restaurant.accepting_orders !== false;
  }, [data]);

  if (notFound) {
    return (
      <main className="min-h-screen bg-canvas px-5 py-16 text-center text-muted">
        Menu not found
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-canvas px-5 py-16 text-center text-muted">
        Loading menu...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas pb-36">
      <CustomerHeader
        restaurantName={data.restaurant.name}
        tableNumber={data.table.table_number}
        zoneName={data.zoneName}
        shopIsOpen={shopOpen}
        openTime={data.restaurant.open_time}
        closeTime={data.restaurant.close_time}
        closedReason={shopOpen ? null : "manually_closed"}
        tableIsOpen={data.table.is_open ?? false}
      />

      <CustomerOrder
        restaurantId={data.restaurant.id}
        tableId={data.table.id}
        tableNumber={data.table.table_number}
        menus={data.menus}
        categories={data.categories}
        promotions={data.promotions}
        shopOpen={shopOpen && (data.table.is_open ?? false)}
        serviceChargePct={Number(data.restaurant.service_charge_pct) || 0}
        vatPct={Number(data.restaurant.vat_pct) || 0}
      />
    </main>
  );
}

