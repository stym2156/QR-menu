"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallStaffRequest, Order } from "@/lib/types";

interface UseKitchenRealtimeOptions {
  supabase: SupabaseClient;
  restaurantId: string;
  soundRef: React.RefObject<boolean>;
  playChime: () => void;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setCalls: React.Dispatch<React.SetStateAction<CallStaffRequest[]>>;
}

export function useKitchenRealtime({
  supabase,
  restaurantId,
  soundRef,
  playChime,
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
          setOrders((prev) => [...prev, payload.new as Order]);
          if (soundRef.current) playChime();
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
            if (next.status === "served") return prev.filter((o) => o.id !== next.id);
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
          if (soundRef.current) playChime();
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
  }, [supabase, restaurantId, soundRef, playChime, setOrders, setCalls]);
}
