"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { playChime, unlockAudio } from "@/lib/sound";
import { formatKIP, formatTime } from "@/lib/format";
import { EmptyState, StatusPill } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import { useKitchenRealtime } from "./useKitchenRealtime";
import type {
  CallStaffRequest,
  DiningTable,
  Menu,
  Order,
  OrderStatus,
} from "@/lib/types";

const SOUND_STORAGE_KEY = "shopqr.kitchen.sound";

interface Props {
  restaurantId: string;
  initialOrders: Order[];
  initialCalls: CallStaffRequest[];
  menus: Menu[];
  tables: DiningTable[];
}

export default function KitchenDisplay({
  restaurantId,
  initialOrders,
  initialCalls,
  menus,
  tables,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [calls, setCalls] = useState<CallStaffRequest[]>(initialCalls);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);

  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  // Restore sound preference from localStorage on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_STORAGE_KEY) === "on") {
        setSoundOn(true);
      }
    } catch {
      // localStorage unavailable (private mode / disabled cookies); ignore.
    }
  }, []);

  // Persist preference + sync ref + ensure audio is unlocked while on.
  // AudioContext needs a user gesture to resume after page reload, so we
  // attach a one-shot listener that resumes on the next interaction.
  useEffect(() => {
    soundRef.current = soundOn;
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, soundOn ? "on" : "off");
    } catch {
      // ignore
    }
    if (!soundOn) return;
    unlockAudio();
    const handler = (): void => unlockAudio();
    document.addEventListener("pointerdown", handler, {
      once: true,
      capture: true,
    });
    return () => {
      document.removeEventListener("pointerdown", handler, true);
    };
  }, [soundOn]);

  useKitchenRealtime({
    supabase,
    restaurantId,
    soundRef,
    playChime,
    setOrders,
    setCalls,
  });

  async function setStatus(order: Order, status: OrderStatus): Promise<void> {
    const snapshot = order;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", order.id);
    if (error) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? snapshot : o)));
    }
  }

  async function cancelOrder(order: Order): Promise<void> {
    const tableNum = tableMap.get(order.table_id)?.table_number;
    const ok = await confirm({
      title: `ยกเลิกออเดอร์โต๊ะที่ ${tableNum}?`,
      description: "ออเดอร์จะหายจากครัวและบิล การกระทำนี้ย้อนกลับไม่ได้",
      confirmText: "ยกเลิกออเดอร์",
      cancelText: "เก็บไว้",
      tone: "danger",
    });
    if (!ok) return;
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) toast.error(`ยกเลิกไม่สำเร็จ: ${error.message}`);
    else toast.success(`ยกเลิกออเดอร์โต๊ะ ${tableNum} แล้ว`);
  }

  async function ackCall(call: CallStaffRequest): Promise<void> {
    setCalls((prev) => prev.filter((c) => c.id !== call.id));
    await supabase
      .from("call_staff_requests")
      .update({ acknowledged: true })
      .eq("id", call.id);
  }

  const pending = orders.filter((o) => o.status === "pending");
  const ready = orders.filter((o) => o.status === "ready");

  return (
    <div className="space-y-5">
      {soundOn ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>🔔 เสียงแจ้งเตือนเปิดอยู่</span>
          </span>
          <button
            onClick={() => setSoundOn(false)}
            className="rounded-md border border-emerald-200 bg-surface px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            ปิดเสียง
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSoundOn(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🔕</span>
            <span className="font-medium">เปิดเสียงแจ้งเตือนเมื่อมีออเดอร์ใหม่</span>
          </span>
          <span className="text-xs text-amber-700">คลิกเพื่อเปิด</span>
        </button>
      )}

      {calls.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-xs">
              🔔
            </span>
            ลูกค้าเรียกพนักงาน ({calls.length})
          </div>
          <ul className="space-y-1.5">
            {calls.map((call) => (
              <li
                key={call.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">
                    โต๊ะที่ {tableMap.get(call.table_id)?.table_number ?? "?"}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {formatTime(call.created_at)}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {call.reason || "(ไม่ระบุ)"}
                  </div>
                </div>
                <button
                  onClick={() => ackCall(call)}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-surface hover:bg-emerald-700"
                >
                  รับทราบ
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Column
          title="รอทำ"
          count={pending.length}
          tone="warning"
          orders={pending}
          menuMap={menuMap}
          tableMap={tableMap}
          actions={(o) => (
            <div className="flex gap-2">
              <button
                onClick={() => cancelOrder(o)}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setStatus(o, "ready")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-surface shadow-card transition hover:bg-emerald-700"
              >
                ทำเสร็จ →
              </button>
            </div>
          )}
        />
        <Column
          title="พร้อมเสิร์ฟ"
          count={ready.length}
          tone="success"
          orders={ready}
          menuMap={menuMap}
          tableMap={tableMap}
          actions={(o) => (
            <button
              onClick={() => setStatus(o, "served")}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-surface shadow-card transition hover:bg-ink/85"
            >
              เสิร์ฟแล้ว ✓
            </button>
          )}
        />
      </div>
    </div>
  );
}

interface ColumnProps {
  title: string;
  count: number;
  tone: "warning" | "success";
  orders: Order[];
  menuMap: Map<string, Menu>;
  tableMap: Map<string, DiningTable>;
  actions: (o: Order) => React.ReactNode;
}

const dotColor: Record<ColumnProps["tone"], string> = {
  warning: "bg-amber-400",
  success: "bg-emerald-500",
};

function Column({
  title,
  count,
  tone,
  orders,
  menuMap,
  tableMap,
  actions,
}: ColumnProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line bg-canvas/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotColor[tone]}`} />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        <span className="text-xs font-medium text-muted">{count} ออเดอร์</span>
      </header>
      {orders.length === 0 ? (
        <div className="px-4 py-12">
          <EmptyState title="ไม่มีออเดอร์" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id} className="space-y-2.5 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold tabular-nums text-surface">
                    {tableMap.get(order.table_id)?.table_number ?? "?"}
                  </span>
                  <span className="text-xs text-muted">
                    โต๊ะ · {formatTime(order.created_at)}
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {formatKIP(order.total)}
                </span>
              </div>
              <ul className="space-y-1">
                {order.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-ink">
                        {menuMap.get(item.menu_id)?.name ?? "(เมนูถูกลบ)"}
                      </span>
                      {item.note ? (
                        <span className="ml-2">
                          <StatusPill tone="warning">📝 {item.note}</StatusPill>
                        </span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted">
                      ×{item.qty}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">{actions(order)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
