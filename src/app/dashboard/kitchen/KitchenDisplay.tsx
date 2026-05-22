"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKIP, formatTime } from "@/lib/format";
import { EmptyState, StatusPill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import { useKitchenRealtime } from "./useKitchenRealtime";
import { CancelOrderDialog } from "./CancelOrderDialog";
import type {
  CallStaffRequest,
  DiningTable,
  Menu,
  Order,
  OrderStatus,
} from "@/lib/types";

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
  const toast = useToast();
  const { t, locale } = useT();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [calls, setCalls] = useState<CallStaffRequest[]>(initialCalls);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  // Realtime: sound notifications are now handled globally by SoundProvider in
  // the dashboard layout, so the kitchen page no longer manages a chime ref.
  useKitchenRealtime({
    supabase,
    restaurantId,
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

  async function confirmCancel(reason: string): Promise<void> {
    const order = cancelTarget;
    if (!order) return;
    const tableNum = tableMap.get(order.table_id)?.table_number;

    // Optimistic: remove from kitchen columns immediately
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setCancelTarget(null);

    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancel_reason: reason })
      .eq("id", order.id);

    if (error) {
      // Rollback on failure
      setOrders((prev) => [...prev, order]);
      toast.error(t("kit.cancel_fail", { error: error.message }));
    } else {
      toast.success(t("kit.cancel_toast", { n: tableNum ?? "?" }));
    }
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
      <p className="rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-xs text-muted">
        {t("kit.sound_hint")}
      </p>

      {calls.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-xs">
              🔔
            </span>
            {t("kit.calls.section", { n: calls.length })}
          </div>
          <ul className="space-y-1.5">
            {calls.map((call) => (
              <li
                key={call.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {t("kit.calls.table_n", {
                      n: tableMap.get(call.table_id)?.table_number ?? "?",
                    })}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {formatTime(call.created_at)}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {call.reason || t("kit.calls.unknown")}
                  </div>
                </div>
                <button
                  onClick={() => ackCall(call)}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-surface hover:bg-emerald-700"
                >
                  {t("kit.calls.ack")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Column
          title={t("kit.pending")}
          count={pending.length}
          tone="warning"
          orders={pending}
          menuMap={menuMap}
          tableMap={tableMap}
          locale={locale}
          actions={(o) => (
            <div className="flex gap-2">
              <button
                onClick={() => setCancelTarget(o)}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                {t("kit.cancel")}
              </button>
              <button
                onClick={() => setStatus(o, "ready")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-surface shadow-card transition hover:bg-emerald-700"
              >
                {t("kit.done_arrow")}
              </button>
            </div>
          )}
        />
        <Column
          title={t("kit.ready")}
          count={ready.length}
          tone="success"
          orders={ready}
          menuMap={menuMap}
          tableMap={tableMap}
          locale={locale}
          actions={(o) => (
            <button
              onClick={() => setStatus(o, "served")}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-surface shadow-card transition hover:bg-ink/85"
            >
              {t("kit.served_check")}
            </button>
          )}
        />
      </div>

      {cancelTarget ? (
        <CancelOrderDialog
          tableNumber={tableMap.get(cancelTarget.table_id)?.table_number ?? "?"}
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      ) : null}
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
  locale: ReturnType<typeof useT>["locale"];
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
  locale,
  actions,
}: ColumnProps) {
  const { t } = useT();
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line bg-canvas/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotColor[tone]}`} />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        <span className="text-xs font-medium text-muted">
          {t("kit.col.count", { n: count })}
        </span>
      </header>
      {orders.length === 0 ? (
        <div className="px-4 py-12">
          <EmptyState title={t("kit.col.empty")} />
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
                    {t("kit.col.table_at", { time: formatTime(order.created_at) })}
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {formatKIP(order.total)}
                </span>
              </div>
              <ul className="space-y-1">
                {order.items.map((item, idx) => {
                  const menu = menuMap.get(item.menu_id);
                  return (
                    <li
                      key={idx}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-ink">
                          {menu ? pickName(menu, locale) : t("kit.no_menu")}
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
                  );
                })}
              </ul>
              <div className="flex justify-end">{actions(order)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
