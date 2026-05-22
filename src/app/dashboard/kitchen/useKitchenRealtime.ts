"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@/lib/types";

interface UseKitchenRealtimeOptions {
  supabase: SupabaseClient;
  restaurantId: string;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setHistory: React.Dispatch<React.SetStateAction<Order[]>>;
}

/**
 * Realtime subscription for the kitchen page — keeps the active and history
 * lists in sync. Call-staff requests now live on the bills page; cooks no
 * longer get those notifications. Sound is handled globally by SoundProvider.
 *
 * Orders moving to `served` or `cancelled` slide into the history list.
 */
export function useKitchenRealtime({
  supabase,
  restaurantId,
  setOrders,
  setHistory,
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
          const isHistory =
            next.status === "served" || next.status === "cancelled";

          setOrders((prev) => {
            if (isHistory) return prev.filter((o) => o.id !== next.id);
            const exists = prev.some((o) => o.id === next.id);
            if (exists) return prev.map((o) => (o.id === next.id ? next : o));
            return [...prev, next];
          });

          if (isHistory) {
            setHistory((prev) => {
              const exists = prev.some((o) => o.id === next.id);
              if (exists) return prev.map((o) => (o.id === next.id ? next : o));
              return [next, ...prev];
            });
          }
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
          setHistory((prev) => prev.filter((o) => o.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, restaurantId, setOrders, setHistory]);
}
