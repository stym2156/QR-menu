import { useEffect, useState } from "react";
import { MENU_SELECT, ORDER_SELECT } from "../lib/db/selects";
import { supabase } from "../lib/supabase";
import type { Menu, Order } from "../lib/types";
import CloseShopView from "../ported/dashboard/close-shop/CloseShopView";

interface CloseShopData {
  orders: Order[];
  menus: Menu[];
}

export function CloseShopPage({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<CloseShopData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const [orders, menus] = await Promise.all([
        supabase()
          .from("orders")
          .select(ORDER_SELECT)
          .eq("restaurant_id", restaurantId)
          .eq("paid", true)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false }),
        supabase().from("menus").select(MENU_SELECT).eq("restaurant_id", restaurantId),
      ]);
      if (!cancelled) {
        setData({
          orders: (orders.data ?? []) as Order[],
          menus: (menus.data ?? []) as Menu[],
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return data ? (
    <CloseShopView orders={data.orders} menus={data.menus} />
  ) : (
    <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
      Loading close-shop report...
    </div>
  );
}
