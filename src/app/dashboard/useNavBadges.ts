"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface NavBadges {
  // Total kitchen attention: pending/ready orders + unacknowledged staff calls.
  // Shown on the Kitchen nav icon so staff sees something demands action.
  kitchen: number;
  // Tables with unpaid bills (distinct table_id from orders where paid = false).
  unpaidTables: number;
}

export function useNavBadges(restaurantId: string | null): NavBadges {
  const [calls, setCalls] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [unpaidTables, setUnpaidTables] = useState(0);

  useEffect(() => {
    if (!restaurantId) return;
    const supabase = createClient();
    let cancelled = false;

    async function loadCalls(): Promise<void> {
      const { data } = await supabase
        .from("call_staff_requests")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("acknowledged", false);
      if (!cancelled) setCalls((data ?? []).length);
    }

    async function loadOrders(): Promise<void> {
      const { data } = await supabase
        .from("orders")
        .select("table_id, status, paid")
        .eq("restaurant_id", restaurantId);
      if (cancelled) return;
      const rows = (data ?? []) as Array<{
        table_id: string;
        status: string;
        paid: boolean;
      }>;
      // Kitchen attention: orders still in pending/ready (not served, not cancelled).
      const pending = rows.filter(
        (o) => o.status === "pending" || o.status === "ready",
      ).length;
      // Unpaid tables: distinct table_id where paid=false and not cancelled.
      const unpaid = new Set(
        rows
          .filter((o) => !o.paid && o.status !== "cancelled")
          .map((o) => o.table_id),
      ).size;
      setPendingOrders(pending);
      setUnpaidTables(unpaid);
    }

    void loadCalls();
    void loadOrders();

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

    return () => {
      cancelled = true;
      void supabase.removeChannel(callsCh);
      void supabase.removeChannel(ordersCh);
    };
  }, [restaurantId]);

  return {
    kitchen: calls + pendingOrders,
    unpaidTables,
  };
}
