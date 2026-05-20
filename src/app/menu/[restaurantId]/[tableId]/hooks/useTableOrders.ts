"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useToast } from "@/components/toast";
import type { Order } from "@/lib/types";

interface UseTableOrdersOptions {
  supabase: SupabaseClient;
  restaurantId: string;
  tableId: string;
}

export function useTableOrders({
  supabase,
  restaurantId,
  tableId,
}: UseTableOrdersOptions): Order[] {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("table_id", tableId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setOrders((data ?? []) as Order[]);
      });

    const channel = supabase
      .channel(`customer:${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          setOrders((prev) => [...prev, payload.new as Order]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          const next = payload.new as Order;
          const old = payload.old as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === next.id ? next : o)),
          );
          if (old.status !== "ready" && next.status === "ready") {
            toast.success("ออเดอร์ของคุณพร้อมเสิร์ฟแล้ว!");
          }
          if (!old.paid && next.paid) {
            toast.success("รับชำระเรียบร้อย ขอบคุณครับ");
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          const old = payload.old as { id: string };
          setOrders((prev) => prev.filter((o) => o.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, restaurantId, tableId, toast]);

  return orders;
}
