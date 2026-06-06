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
    let ordersTimer: ReturnType<typeof setTimeout> | null = null;
    let callsTimer: ReturnType<typeof setTimeout> | null = null;

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
      const { count } = await supabase
        .from("call_staff_requests")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("acknowledged", false);
      if (!cancelled) setCalls(count ?? 0);
    }

    function scheduleOrders(delay = 120): void {
      if (ordersTimer) clearTimeout(ordersTimer);
      ordersTimer = setTimeout(() => void loadOrders(), delay);
    }

    function scheduleCalls(delay = 120): void {
      if (callsTimer) clearTimeout(callsTimer);
      callsTimer = setTimeout(() => void loadCalls(), delay);
    }

    scheduleOrders();
    scheduleCalls();

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
        () => scheduleOrders(250),
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
        () => scheduleCalls(250),
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (ordersTimer) clearTimeout(ordersTimer);
      if (callsTimer) clearTimeout(callsTimer);
      void supabase.removeChannel(ordersCh);
      void supabase.removeChannel(callsCh);
    };
  }, [restaurantId]);

  return {
    kitchen: pendingOrders,
    bills: unpaidTables + calls,
  };
}
