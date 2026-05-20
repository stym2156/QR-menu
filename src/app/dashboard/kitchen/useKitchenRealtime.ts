"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallStaffRequest, Order } from "@/lib/types";

interface UseKitchenRealtimeOptions {
  supabase: SupabaseClient;
  restaurantId: string;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setCalls: React.Dispatch<React.SetStateAction<CallStaffRequest[]>>;
}

/**
 * Local realtime subscription for the kitchen page — keeps the on-screen order
 * and call-staff lists in sync. Sound notifications are handled globally by
 * `SoundProvider`, so this hook intentionally does NOT play any chime.
 *
 * Orders that move to `served` or `cancelled` are removed from kitchen view.
 */
export function useKitchenRealtime({
  supabase,
  restaurantId,
  setOrders,
  setCalls,
}: UseKitchenRealtimeOptions): void {
  useEffect(() => {
    const channel = supabase
      .channel(`kitchen:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const next = payload.new as Order;
          // Only surface active orders in the kitchen
          if (next.status === "pending" || next.status === "ready") {
            setOrders((prev) => [...prev, next]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const next = payload.new as Order;
          setOrders((prev) => {
            // Remove from kitchen once it leaves the active states
            if (next.status === "served" || next.status === "cancelled") {
              return prev.filter((o) => o.id !== next.id);
            }
            return prev.map((o) => (o.id === next.id ? next : o));
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const old = payload.old as { id: string };
          setOrders((prev) => prev.filter((o) => o.id !== old.id));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_staff_requests",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          setCalls((prev) => [...prev, payload.new as CallStaffRequest]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_staff_requests",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const next = payload.new as CallStaffRequest;
          setCalls((prev) =>
            next.acknowledged
              ? prev.filter((c) => c.id !== next.id)
              : prev.map((c) => (c.id === next.id ? next : c)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, restaurantId, setOrders, setCalls]);
}
