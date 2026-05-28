"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKIP, formatDateTime, formatTime } from "@/lib/format";
import { EmptyState, StatusPill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import { useKitchenRealtime } from "./useKitchenRealtime";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { KitchenPrinterBar } from "./KitchenPrinterBar";
import { buildKitchenTicketBytes } from "@/lib/escposKitchenTicket";
import { getActivePrinter, printToActivePrinter } from "@/lib/printer";
import { printKitchenTicketSystem } from "@/lib/printKitchenTicketSystem";
import { logAudit } from "@/lib/audit";
import type { DiningTable, Menu, Order, TableZone } from "@/lib/types";
import type { Locale } from "@/lib/i18n/types";

interface Props {
  restaurantId: string;
  initialOrders: Order[];
  initialHistory: Order[];
  menus: Menu[];
  tables: DiningTable[];
  zones: TableZone[];
  memberEmails: Record<string, string>;
  canAct: boolean;
  kitchenPrintWidth: number;
}

type KitchenTab = "active" | "history";

export default function KitchenDisplay({
  restaurantId,
  initialOrders,
  initialHistory,
  menus,
  tables,
  zones,
  memberEmails,
  canAct,
  kitchenPrintWidth,
}: Props) {
  const supabase = createClient();
  const toast = useToast();
  const { t, locale } = useT();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [history, setHistory] = useState<Order[]>(initialHistory);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [tab, setTab] = useState<KitchenTab>("active");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [systemPrintEnabled, setSystemPrintEnabled] = useState(false);
  const autoPrintRef = useRef(false);
  const systemPrintRef = useRef(false);

  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  // Keep refs in sync — the realtime callback below captures them at subscribe
  // time, so we use refs to read the latest values.
  useEffect(() => {
    autoPrintRef.current = autoPrintEnabled;
  }, [autoPrintEnabled]);

  useEffect(() => {
    systemPrintRef.current = systemPrintEnabled;
  }, [systemPrintEnabled]);

  // Mark an order as served + slide it from the active list into history.
  // Triggered automatically after a successful print (so cook only has to
  // touch orders that the printer couldn't handle) and manually via the
  // "Done" button when there's no printer at all.
  const completeOrder = useCallback(
    async (order: Order, options?: { silent?: boolean }): Promise<boolean> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const now = new Date().toISOString();

      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setHistory((prev) => [
        {
          ...order,
          status: "served",
          completed_at: now,
          completed_by: uid,
        },
        ...prev,
      ]);

      const { error } = await supabase
        .from("orders")
        .update({
          status: "served",
          completed_at: now,
          completed_by: uid,
        })
        .eq("id", order.id);

      if (error) {
        // Rollback optimistic move.
        setOrders((prev) => [...prev, order]);
        setHistory((prev) => prev.filter((o) => o.id !== order.id));
        toast.error(t("kit.complete_fail", { error: error.message }));
        return false;
      }
      void logAudit(supabase, restaurantId, {
        action: "order.served",
        targetId: order.id,
        details: {
          table_number: tableMap.get(order.table_id)?.table_number ?? null,
          total: order.total,
          item_count: (order.items ?? []).length,
        },
      });
      if (!options?.silent) {
        const tableNum = tableMap.get(order.table_id)?.table_number;
        toast.success(t("kit.done_toast", { n: tableNum ?? "?" }));
      }
      return true;
    },
    [supabase, toast, t, tableMap, restaurantId],
  );

  const handleNewOrder = useCallback(
    async (order: Order) => {
      const table = tableMap.get(order.table_id);
      const tableNumber = table?.table_number ?? 0;
      const hasDirect = getActivePrinter() !== null;

      // Path 1: direct BT/USB printer wins when available + auto-print toggle on.
      if (autoPrintRef.current && hasDirect) {
        const bytes = buildKitchenTicketBytes({
          order,
          menus,
          tableNumber,
          widthMm: kitchenPrintWidth,
          locale: locale as Locale,
        });
        const result = await printToActivePrinter(bytes);
        if (result.ok) {
          // Successful direct print → auto-move to history (silent — the
          // printout is the cook's notification, no need for a toast too).
          await completeOrder(order, { silent: true });
        } else {
          toast.error(t("kitchen_print.auto_failed", { error: result.error }));
          setAutoPrintEnabled(false);
          try {
            localStorage.setItem("qrmenu.kitchen.autoPrint", "false");
          } catch {
            /* noop */
          }
        }
        return;
      }

      // Path 2: no direct printer — fall back to OS print pipeline if owner
      // enabled it. Best paired with Chrome --kiosk-printing for silent print.
      // We can't know whether the user pressed Print or Cancel on the dialog
      // (browsers don't expose that), so we trust the cook to be responsible
      // — see the toggle description on the printer bar.
      if (systemPrintRef.current && !hasDirect) {
        printKitchenTicketSystem({
          order,
          menus,
          tableNumber,
          widthMm: kitchenPrintWidth,
          locale: locale as Locale,
        });
        await completeOrder(order, { silent: true });
      }
    },
    [tableMap, menus, kitchenPrintWidth, locale, toast, t, completeOrder],
  );

  useKitchenRealtime({
    supabase,
    restaurantId,
    setOrders,
    setHistory,
    onNewOrder: handleNewOrder,
  });

  // Manual print from the active list. The order moves to history on a
  // successful print (so cook only sees what's still pending action). For a
  // pure copy without status change, use the Reprint button in History.
  async function printActiveOrder(order: Order): Promise<void> {
    const table = tableMap.get(order.table_id);
    const tableNumber = table?.table_number ?? 0;
    const hasDirect = getActivePrinter() !== null;

    if (hasDirect) {
      setBusyId(order.id);
      const bytes = buildKitchenTicketBytes({
        order,
        menus,
        tableNumber,
        widthMm: kitchenPrintWidth,
        locale: locale as Locale,
      });
      const result = await printToActivePrinter(bytes);
      setBusyId(null);
      if (result.ok) {
        await completeOrder(order, { silent: true });
        toast.success(t("kit.print_toast"));
      } else {
        toast.error(t("bt.print_failed", { error: result.error }));
      }
      return;
    }

    if (systemPrintRef.current) {
      setBusyId(order.id);
      printKitchenTicketSystem({
        order,
        menus,
        tableNumber,
        widthMm: kitchenPrintWidth,
        locale: locale as Locale,
      });
      await completeOrder(order, { silent: true });
      toast.success(t("kit.print_toast"));
      setBusyId(null);
      return;
    }

    toast.error(t("kitchen_print.not_connected"));
  }

  async function markActiveDone(order: Order): Promise<void> {
    setBusyId(order.id);
    await completeOrder(order);
    setBusyId(null);
  }

  function buildTestBytes(): Uint8Array {
    // Send a minimal sanity-check ticket to confirm the printer wakes up
    // and the codepage/feed/cut commands all work.
    const sample: Order = {
      id: "test-0000",
      table_id: "",
      restaurant_id: restaurantId,
      items: [
        {
          menu_id: "test",
          qty: 1,
          note: t("kitchen_print.test_sent"),
        },
      ],
      status: "pending",
      total: 0,
      paid: false,
      paid_at: null,
      payment_method: null,
      cancel_reason: null,
      accepted_at: null,
      accepted_by: null,
      completed_at: null,
      completed_by: null,
      created_at: new Date().toISOString(),
    };
    return buildKitchenTicketBytes({
      order: sample,
      menus: [
        {
          id: "test",
          restaurant_id: restaurantId,
          category_id: null,
          name: "TEST PRINT",
          name_lo: null,
          name_en: null,
          price: 0,
          image_url: null,
          available: true,
          created_at: new Date().toISOString(),
        },
      ],
      tableNumber: 0,
      widthMm: kitchenPrintWidth,
      locale: locale as Locale,
      badge: t("kitchen_print.test"),
    });
  }

  function runSystemTestPrint(): void {
    const sample: Order = {
      id: "test-0000",
      table_id: "",
      restaurant_id: restaurantId,
      items: [
        {
          menu_id: "test",
          qty: 1,
          note: t("kitchen_print.test_sent"),
        },
      ],
      status: "pending",
      total: 0,
      paid: false,
      paid_at: null,
      payment_method: null,
      cancel_reason: null,
      accepted_at: null,
      accepted_by: null,
      completed_at: null,
      completed_by: null,
      created_at: new Date().toISOString(),
    };
    printKitchenTicketSystem({
      order: sample,
      menus: [
        {
          id: "test",
          restaurant_id: restaurantId,
          category_id: null,
          name: "TEST PRINT",
          name_lo: null,
          name_en: null,
          price: 0,
          image_url: null,
          available: true,
          created_at: new Date().toISOString(),
        },
      ],
      tableNumber: 0,
      widthMm: kitchenPrintWidth,
      locale: locale as Locale,
      badge: t("kitchen_print.test"),
    });
  }

  async function confirmCancel(reason: string): Promise<void> {
    const order = cancelTarget;
    if (!order) return;
    const tableNum = tableMap.get(order.table_id)?.table_number;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const now = new Date().toISOString();

    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setHistory((prev) => [
      {
        ...order,
        status: "cancelled",
        cancel_reason: reason,
        completed_at: now,
        completed_by: uid,
      },
      ...prev,
    ]);
    setCancelTarget(null);

    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: reason,
        completed_at: now,
        completed_by: uid,
      })
      .eq("id", order.id);

    if (error) {
      setOrders((prev) => [...prev, order]);
      setHistory((prev) => prev.filter((o) => o.id !== order.id));
      toast.error(t("kit.cancel_fail", { error: error.message }));
    } else {
      void logAudit(supabase, restaurantId, {
        action: "order.cancel",
        targetId: order.id,
        details: {
          table_number: tableNum ?? null,
          reason,
          total: order.total,
        },
      });
      toast.success(t("kit.cancel_toast", { n: tableNum ?? "?" }));
    }
  }

  // Active = anything still on the kitchen's radar (pending or ready).
  // Sort so the table that ordered earliest pulls all its tickets together
  // and tables that ordered later follow.
  const activeOrders = useMemo(() => {
    const inProgress = orders.filter(
      (o) => o.status === "pending" || o.status === "ready",
    );
    const earliestByTable = new Map<string, string>();
    for (const o of inProgress) {
      const cur = earliestByTable.get(o.table_id);
      if (!cur || o.created_at < cur) {
        earliestByTable.set(o.table_id, o.created_at);
      }
    }
    return [...inProgress].sort((a, b) => {
      const ea = earliestByTable.get(a.table_id) ?? a.created_at;
      const eb = earliestByTable.get(b.table_id) ?? b.created_at;
      if (ea !== eb) return ea < eb ? -1 : 1;
      if (a.created_at !== b.created_at) {
        return a.created_at < b.created_at ? -1 : 1;
      }
      return 0;
    });
  }, [orders]);

  const filteredActiveOrders = useMemo(() => {
    if (zoneFilter === "all") return activeOrders;
    return activeOrders.filter((order) => tableMap.get(order.table_id)?.zone_id === zoneFilter);
  }, [activeOrders, tableMap, zoneFilter]);

  const filteredHistory = useMemo(() => {
    if (zoneFilter === "all") return history;
    return history.filter((order) => tableMap.get(order.table_id)?.zone_id === zoneFilter);
  }, [history, tableMap, zoneFilter]);

  return (
    <div className="space-y-4">
      {canAct ? (
        <KitchenPrinterBar
          onAutoPrintChange={setAutoPrintEnabled}
          onSystemPrintChange={setSystemPrintEnabled}
          onTestPrint={buildTestBytes}
          onTestSystemPrint={runSystemTestPrint}
        />
      ) : null}

      <div className="flex gap-1.5 rounded-xl bg-canvas p-1">
        <TabButton
          label={t("kit.tab.active")}
          count={filteredActiveOrders.length}
          active={tab === "active"}
          onClick={() => setTab("active")}
        />
        <TabButton
          label={t("kit.tab.history")}
          active={tab === "history"}
          onClick={() => setTab("history")}
        />
      </div>

      {zones.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <ZoneChip
            label="ทุกโซน"
            active={zoneFilter === "all"}
            onClick={() => setZoneFilter("all")}
          />
          {zones.map((zone) => (
            <ZoneChip
              key={zone.id}
              label={zone.name}
              active={zoneFilter === zone.id}
              onClick={() => setZoneFilter(zone.id)}
            />
          ))}
        </div>
      ) : null}

      {tab === "active" ? (
        <ActiveList
          orders={filteredActiveOrders}
          menuMap={menuMap}
          tableMap={tableMap}
          zoneMap={zoneMap}
          locale={locale}
          canAct={canAct}
          busyId={busyId}
          onCancel={(o) => setCancelTarget(o)}
          onPrint={printActiveOrder}
          onDone={markActiveDone}
        />
      ) : (
        <HistoryList
          orders={filteredHistory}
          menuMap={menuMap}
          tableMap={tableMap}
          zoneMap={zoneMap}
          locale={locale}
          memberEmails={memberEmails}
        />
      )}

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

interface ZoneChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ZoneChip({ label, active, onClick }: ZoneChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-ink text-surface"
          : "border border-line bg-surface text-ink hover:border-ink/30 hover:bg-canvas"
      }`}
    >
      {label}
    </button>
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
        active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
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

interface ActiveListProps {
  orders: Order[];
  menuMap: Map<string, Menu>;
  tableMap: Map<string, DiningTable>;
  zoneMap: Map<string, TableZone>;
  locale: ReturnType<typeof useT>["locale"];
  canAct: boolean;
  busyId: string | null;
  onCancel: (o: Order) => void;
  onPrint: (o: Order) => void;
  onDone: (o: Order) => void;
}

function ActiveList({
  orders,
  menuMap,
  tableMap,
  zoneMap,
  locale,
  canAct,
  busyId,
  onCancel,
  onPrint,
  onDone,
}: ActiveListProps) {
  const { t } = useT();
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center">
        <EmptyState title={t("kit.col.empty")} description={t("kit.empty.desc")} />
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((order) => (
        <li
          key={order.id}
          className="overflow-hidden rounded-2xl border border-line bg-surface"
        >
          <div className="space-y-2.5 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold tabular-nums text-surface">
                  {tableMap.get(order.table_id)?.table_number ?? "?"}
                </span>
                <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
                  {zoneMap.get(tableMap.get(order.table_id)?.zone_id ?? "")?.name ?? "ไม่ระบุโซน"}
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
            {canAct ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-2.5">
                <button
                  type="button"
                  onClick={() => onCancel(order)}
                  disabled={busyId === order.id}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {t("kit.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => onPrint(order)}
                  disabled={busyId === order.id}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-50"
                >
                  {t("kit.action.print")}
                </button>
                <button
                  type="button"
                  onClick={() => onDone(order)}
                  disabled={busyId === order.id}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {t("kit.action.done")}
                </button>
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

interface HistoryListProps {
  orders: Order[];
  menuMap: Map<string, Menu>;
  tableMap: Map<string, DiningTable>;
  zoneMap: Map<string, TableZone>;
  locale: ReturnType<typeof useT>["locale"];
  memberEmails: Record<string, string>;
}

function HistoryList({
  orders,
  menuMap,
  tableMap,
  zoneMap,
  locale,
  memberEmails,
}: HistoryListProps) {
  const { t } = useT();
  if (orders.length === 0) {
    return (
      <EmptyState
        title={t("kit.history.empty")}
        description={t("kit.history.empty.desc")}
      />
    );
  }
  return (
    <ul className="space-y-2.5">
      {orders.map((order) => {
        const isCancelled = order.status === "cancelled";
        return (
          <li
            key={order.id}
            className={`overflow-hidden rounded-2xl border bg-surface ${
              isCancelled ? "border-red-100/60" : "border-line"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold tabular-nums text-surface">
                  {tableMap.get(order.table_id)?.table_number ?? "?"}
                </span>
                <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
                  {zoneMap.get(tableMap.get(order.table_id)?.zone_id ?? "")?.name ?? "ไม่ระบุโซน"}
                </span>
                <span className="text-xs text-muted">
                  {order.completed_at
                    ? formatDateTime(order.completed_at)
                    : formatDateTime(order.created_at)}
                </span>
                {isCancelled ? (
                  <StatusPill tone="warning">{t("cust.status.cancelled")}</StatusPill>
                ) : (
                  <StatusPill tone="success">{t("cust.status.served")}</StatusPill>
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums text-ink">
                {formatKIP(order.total)}
              </span>
            </div>
            <ul className="space-y-1 px-4 py-3">
              {order.items.map((item, idx) => {
                const menu = menuMap.get(item.menu_id);
                return (
                  <li
                    key={idx}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className={isCancelled ? "line-through text-muted" : "text-ink"}>
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
            <div className="space-y-0.5 border-t border-line bg-canvas/30 px-4 py-2 text-[11px] text-muted">
              {order.completed_by ? (
                <div>
                  {t("kit.col.completed_by", {
                    email:
                      memberEmails[order.completed_by] ??
                      order.completed_by.slice(0, 8),
                  })}
                </div>
              ) : null}
              {isCancelled && order.cancel_reason ? (
                <div>{t("kit.calls.reason", { reason: order.cancel_reason })}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
