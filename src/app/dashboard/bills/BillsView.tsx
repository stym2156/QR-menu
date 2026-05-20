"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKIP, formatTime } from "@/lib/format";
import { EmptyState, buttonSecondary } from "@/components/ui";
import { useToast } from "@/components/toast";
import { printReceipt } from "./receipt";
import { BillModal, type BillGroup } from "./BillModal";
import type {
  DiningTable,
  Menu,
  Order,
  PaymentMethod,
} from "@/lib/types";

interface Props {
  restaurantId: string;
  restaurantName: string;
  serviceChargePct: number;
  vatPct: number;
  initialOrders: Order[];
  tables: DiningTable[];
  menus: Menu[];
}

export default function BillsView({
  restaurantId,
  restaurantName,
  serviceChargePct,
  vatPct,
  initialOrders,
  tables,
  menus,
}: Props) {
  const supabase = createClient();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [lastSettled, setLastSettled] = useState<{
    orders: Order[];
    table: DiningTable | undefined;
    method: PaymentMethod;
    paidAt: string;
  } | null>(null);

  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  const byTable = useMemo<BillGroup[]>(() => {
    const groups = new Map<string, Order[]>();
    for (const o of orders) {
      const arr = groups.get(o.table_id) ?? [];
      arr.push(o);
      groups.set(o.table_id, arr);
    }
    return Array.from(groups.entries())
      .map<BillGroup>(([tableId, list]) => ({
        tableId,
        table: tableMap.get(tableId),
        orders: list,
        total: list.reduce((s, o) => s + Number(o.total), 0),
        itemCount: list.reduce(
          (s, o) => s + o.items.reduce((q, it) => q + it.qty, 0),
          0,
        ),
      }))
      .filter((g) => g.table)
      .sort(
        (a, b) => (a.table?.table_number ?? 0) - (b.table?.table_number ?? 0),
      );
  }, [orders, tableMap]);

  const grandTotal = byTable.reduce((s, g) => s + g.total, 0);

  useEffect(() => {
    const channel = supabase
      .channel(`bills:${restaurantId}`)
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
          if (!next.paid && next.status !== "cancelled") {
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
            // Drop from bill view if it's paid OR cancelled
            if (next.paid || next.status === "cancelled") {
              return prev.filter((o) => o.id !== next.id);
            }
            const exists = prev.some((o) => o.id === next.id);
            if (exists) return prev.map((o) => (o.id === next.id ? next : o));
            return [...prev, next];
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, supabase]);

  async function settleBill(tableId: string, method: PaymentMethod): Promise<void> {
    const now = new Date().toISOString();
    const tableOrders = orders.filter((o) => o.table_id === tableId && !o.paid);
    const ids = tableOrders.map((o) => o.id);
    if (ids.length === 0) return;

    setOrders((prev) => prev.filter((o) => !ids.includes(o.id)));

    const { error } = await supabase
      .from("orders")
      .update({ paid: true, paid_at: now, payment_method: method })
      .in("id", ids);

    if (error) {
      toast.error(`รับชำระไม่สำเร็จ: ${error.message}`);
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("paid", false);
      setOrders((data ?? []) as Order[]);
      return;
    }

    // Auto-close the table after settling — customer can't accidentally
    // (or maliciously) submit more orders after they leave.
    const { error: closeError } = await supabase
      .from("tables")
      .update({ is_open: false })
      .eq("id", tableId);
    if (closeError) {
      toast.error(`ปิดโต๊ะอัตโนมัติไม่สำเร็จ: ${closeError.message}`);
    }

    setLastSettled({
      orders: tableOrders,
      table: tableMap.get(tableId),
      method,
      paidAt: now,
    });
    toast.success("รับชำระเรียบร้อย · ปิดโต๊ะแล้ว");
  }

  function handlePrintLastReceipt(): void {
    if (!lastSettled || !lastSettled.table) return;
    printReceipt({
      restaurantName,
      tableNumber: lastSettled.table.table_number,
      orders: lastSettled.orders,
      menus,
      method: lastSettled.method,
      paidAt: lastSettled.paidAt,
      serviceChargePct,
      vatPct,
    });
  }

  const selectedGroup = byTable.find((g) => g.tableId === selectedTableId);

  return (
    <>
      {lastSettled && lastSettled.table ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">รับชำระโต๊ะ {lastSettled.table.table_number} แล้ว</span>
            <span className="ml-2 text-emerald-700">
              {formatKIP(
                lastSettled.orders.reduce(
                  (s, o) => s + Number(o.total),
                  0,
                ),
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrintLastReceipt}
              className={`${buttonSecondary} py-2 text-xs`}
            >
              🖨 พิมพ์ใบเสร็จ
            </button>
            <button
              onClick={() => setLastSettled(null)}
              className="rounded-lg px-2 py-2 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              ปิด
            </button>
          </div>
        </div>
      ) : null}

      {byTable.length === 0 ? (
        <EmptyState
          title="ยังไม่มีโต๊ะที่ค้างบิล"
          description="เมื่อมีลูกค้าสั่งอาหาร โต๊ะจะปรากฏที่นี่"
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              ยอดค้างชำระทั้งหมด
            </span>
            <span className="text-xl font-semibold tabular-nums tracking-tight text-ink">
              {formatKIP(grandTotal)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byTable.map((group) => (
              <button
                key={group.tableId}
                onClick={() => setSelectedTableId(group.tableId)}
                className="group rounded-2xl border border-line bg-surface p-5 text-left transition hover:border-ink/30 hover:shadow-card"
              >
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-sm font-semibold tabular-nums text-surface">
                      {group.table?.table_number}
                    </span>
                    <div className="text-xs text-muted">
                      <div>{group.orders.length} ออเดอร์</div>
                      <div>{group.itemCount} รายการ</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted">
                    เริ่ม {formatTime(group.orders[0].created_at)}
                  </span>
                </div>
                <div className="mt-4 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatKIP(group.total)}
                </div>
                <div className="mt-1 text-xs font-medium text-muted transition group-hover:text-ink">
                  รับชำระ →
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedGroup && (
        <BillModal
          group={selectedGroup}
          menuMap={menuMap}
          serviceChargePct={serviceChargePct}
          vatPct={vatPct}
          onClose={() => setSelectedTableId(null)}
          onSettle={async (method) => {
            await settleBill(selectedGroup.tableId, method);
            setSelectedTableId(null);
          }}
        />
      )}
    </>
  );
}
