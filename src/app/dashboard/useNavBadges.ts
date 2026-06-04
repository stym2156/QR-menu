"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface NavBadges {
  // Kitchen: pending/ready orders only (staff calls now show on bills).
  kitchen: number;
  // Bills: unpaid tables + unacknowledged staff calls combined.
  bills: number;
}

export function useNavBadges(restaurantId: string | null): NavBadges {
  const [pendingOrders, setPendingOrders] = useState(0);
  const [unpaidTables, setUnpaidTables] = useState(0);
  const [calls, setCalls] = useState(0);

  useEffect(() => {
    if (!restaurantId) return;
    const supabase = createClient();
    let cancelled = false;

    async function loadOrders(): Promise<void> {
      const [{ count: pending }, { data: unpaidRows }] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .in("status", ["pending", "ready"]),
        supabase
          .from("orders")
          .select("table_id")
          .eq("restaurant_id", restaurantId)
          .eq("paid", false)
          .neq("status", "cancelled"),
      ]);
      if (cancelled) return;
      const unpaid = new Set(
        ((unpaidRows ?? []) as Array<{ table_id: string }>).map((o) => o.table_id),
      ).size;
      setPendingOrders(pending ?? 0);
      setUnpaidTables(unpaid);
    }

    async function loadCalls(): Promise<void> {
      const { data } = await supabase
        .from("call_staff_requests")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("acknowledged", false);
      if (!cancelled) setCalls((data ?? []).length);
    }

    void loadOrders();
    void loadCalls();

    const ordersCh = supabase
      .channel(`nav-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => void loadOrders(),
      )
      .subscribe();

    const callsCh = supabase
      .channel(`nav-calls-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_staff_requests",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => void loadCalls(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(ordersCh);
      void supabase.removeChannel(callsCh);
    };
  }, [restaurantId]);

  return {
    kitchen: pendingOrders,
    bills: unpaidTables + calls,
  };
}
