"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKIP, formatTime } from "@/lib/format";
import { EmptyState, buttonSecondary } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";
import { printReceipt } from "./receipt";
import { BillModal, type BillGroup } from "./BillModal";
import SettledBills from "./SettledBills";
import type {
  CallStaffRequest,
  DiningTable,
  Menu,
  Order,
  PaymentMethod,
} from "@/lib/types";

type Tab = "unpaid" | "settled";

interface Props {
  restaurantId: string;
  restaurantName: string;
  serviceChargePct: number;
  vatPct: number;
  paymentQrUrl: string | null;
  initialOrders: Order[];
  initialSettledOrders: Order[];
  tables: DiningTable[];
  menus: Menu[];
  initialCalls: CallStaffRequest[];
}

export default function BillsView({
  restaurantId,
  restaurantName,
  serviceChargePct,
  vatPct,
  paymentQrUrl,
  initialOrders,
  initialSettledOrders,
  tables,
  menus,
  initialCalls,
}: Props) {
  const supabase = createClient();
  const toast = useToast();
  const { t, locale } = useT();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [settledOrders, setSettledOrders] = useState<Order[]>(initialSettledOrders);
  const [calls, setCalls] = useState<CallStaffRequest[]>(initialCalls);
  const [tab, setTab] = useState<Tab>("unpaid");
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
          // Keep settled list in sync — add when paid, update if already there.
          if (next.paid) {
            setSettledOrders((prev) => {
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
        },
      )
      // Staff calls (เรียกพนักงาน) — moved from kitchen page here so waiters /
      // owners on the bills view see them, not cooks who can't act on them.
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
  }, [restaurantId, supabase]);

  async function ackCall(call: CallStaffRequest): Promise<void> {
    setCalls((prev) => prev.filter((c) => c.id !== call.id));
    const { error } = await supabase
      .from("call_staff_requests")
      .update({ acknowledged: true })
      .eq("id", call.id);
    if (error) {
      toast.error(t("kit.ack_failed", { error: error.message }));
      // Restore if update failed
      setCalls((prev) => [...prev, call]);
    }
  }

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
      toast.error(t("bill.settle.failed", { error: error.message }));
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
      toast.error(t("bill.close_failed", { error: closeError.message }));
    }

    setLastSettled({
      orders: tableOrders,
      table: tableMap.get(tableId),
      method,
      paidAt: now,
    });
    // Optimistically push into the settled-bills list so the "ปิดบิลแล้ว"
    // tab reflects the new bill immediately, regardless of realtime latency.
    setSettledOrders((prev) => {
      const updated = tableOrders.map((o) => ({
        ...o,
        paid: true,
        paid_at: now,
        payment_method: method,
      }));
      const ids = new Set(updated.map((o) => o.id));
      return [...updated, ...prev.filter((o) => !ids.has(o.id))];
    });
    toast.success(t("bill.settled.toast.success"));
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
      paymentQrUrl,
      locale,
    });
  }

  const selectedGroup = byTable.find((g) => g.tableId === selectedTableId);

  return (
    <>
      {calls.length > 0 && (
        <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
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

      {lastSettled && lastSettled.table ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">
              {t("bill.settled.banner", { n: lastSettled.table.table_number })}
            </span>
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
              {t("bill.settled.print")}
            </button>
            <button
              onClick={() => setLastSettled(null)}
              className="rounded-lg px-2 py-2 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              {t("bill.settled.close")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex gap-1.5 rounded-xl bg-canvas p-1">
        <TabButton
          label={t("page.bills.tab.unpaid")}
          count={byTable.length}
          active={tab === "unpaid"}
          onClick={() => setTab("unpaid")}
        />
        <TabButton
          label={t("page.bills.tab.settled")}
          active={tab === "settled"}
          onClick={() => setTab("settled")}
        />
      </div>

      {tab === "unpaid" ? (
        byTable.length === 0 ? (
          <EmptyState
            title={t("bill.unpaid.empty.title")}
            description={t("bill.unpaid.empty.desc")}
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                {t("bill.unpaid.total")}
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
                        <div>{t("bill.unpaid.orders_n", { n: group.orders.length })}</div>
                        <div>{t("bill.unpaid.items_n", { n: group.itemCount })}</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted">
                      {t("bill.unpaid.start", { time: formatTime(group.orders[0].created_at) })}
                    </span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                    {formatKIP(group.total)}
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted transition group-hover:text-ink">
                    {t("bill.unpaid.settle_cta")}
                  </div>
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <SettledBills
          settledOrders={settledOrders}
          tables={tables}
          menus={menus}
          restaurantName={restaurantName}
          serviceChargePct={serviceChargePct}
          vatPct={vatPct}
          paymentQrUrl={paymentQrUrl}
        />
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

interface TabButtonProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, count, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-surface text-ink shadow-sm"
          : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span
          className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
            active ? "bg-ink text-surface" : "bg-line text-muted"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
