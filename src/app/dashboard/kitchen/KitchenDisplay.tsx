"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKIP, formatDateTime, formatTime } from "@/lib/format";
import { EmptyState, StatusPill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import { useKitchenRealtime } from "./useKitchenRealtime";
import { CancelOrderDialog } from "./CancelOrderDialog";
import type { DiningTable, Menu, Order } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialOrders: Order[];
  initialHistory: Order[];
  menus: Menu[];
  tables: DiningTable[];
  memberEmails: Record<string, string>;
  canAct: boolean;
}

type KitchenTab = "active" | "history";

export default function KitchenDisplay({
  restaurantId,
  initialOrders,
  initialHistory,
  menus,
  tables,
  memberEmails,
  canAct,
}: Props) {
  const supabase = createClient();
  const toast = useToast();
  const { t, locale } = useT();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [history, setHistory] = useState<Order[]>(initialHistory);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [tab, setTab] = useState<KitchenTab>("active");
  const [busyId, setBusyId] = useState<string | null>(null);

  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  useKitchenRealtime({
    supabase,
    restaurantId,
    setOrders,
    setHistory,
  });

  async function acceptOrder(order: Order): Promise<void> {
    setBusyId(order.id);
    const now = new Date().toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    // Optimistic update so the button switches state right away.
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, accepted_at: now, accepted_by: uid } : o,
      ),
    );

    const { error } = await supabase
      .from("orders")
      .update({ accepted_at: now, accepted_by: uid })
      .eq("id", order.id);
    setBusyId(null);
    if (error) {
      // Rollback
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, accepted_at: null, accepted_by: null }
            : o,
        ),
      );
      toast.error(t("kit.update_failed", { error: error.message }));
    }
  }

  async function markReady(order: Order): Promise<void> {
    setBusyId(order.id);
    const now = new Date().toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, status: "ready" } : o,
      ),
    );

    const { error } = await supabase
      .from("orders")
      .update({
        status: "ready",
        completed_at: now,
        completed_by: uid,
      })
      .eq("id", order.id);
    setBusyId(null);
    if (error) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, status: "pending" } : o,
        ),
      );
      toast.error(t("kit.update_failed", { error: error.message }));
    }
  }

  async function markServed(order: Order): Promise<void> {
    setBusyId(order.id);
    const now = new Date().toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    // Reuse completed_by/at if not set (e.g. someone marked served without
    // first hitting "Done" — covers waiter shortcuts).
    const patch: Partial<Order> = { status: "served" };
    if (!order.completed_at) {
      patch.completed_at = now;
      patch.completed_by = uid;
    }

    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setHistory((prev) => [{ ...order, ...patch }, ...prev]);

    const { error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", order.id);
    setBusyId(null);
    if (error) {
      // Rollback by reloading from server isn't worth it for this simple case
      toast.error(t("kit.update_failed", { error: error.message }));
    }
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
      toast.success(t("kit.cancel_toast", { n: tableNum ?? "?" }));
    }
  }

  // Sort orders so a table's earliest order pulls all that table's other
  // orders to the same position — keeps a table's tickets clustered, and
  // tables that ordered earlier appear before tables that ordered later.
  const sortedOrders = useMemo(() => {
    const earliestByTable = new Map<string, string>();
    for (const o of orders) {
      const cur = earliestByTable.get(o.table_id);
      if (!cur || o.created_at < cur) {
        earliestByTable.set(o.table_id, o.created_at);
      }
    }
    return [...orders].sort((a, b) => {
      const ea = earliestByTable.get(a.table_id) ?? a.created_at;
      const eb = earliestByTable.get(b.table_id) ?? b.created_at;
      if (ea !== eb) return ea < eb ? -1 : 1;
      // Same table — keep chronological within the group.
      if (a.created_at !== b.created_at) {
        return a.created_at < b.created_at ? -1 : 1;
      }
      return 0;
    });
  }, [orders]);

  // Pending splits into "ที่ต้องทำ" (not accepted) and "กำลังทำ" (accepted).
  const pendingNew = sortedOrders.filter(
    (o) => o.status === "pending" && !o.accepted_at,
  );
  const pendingAccepted = sortedOrders.filter(
    (o) => o.status === "pending" && !!o.accepted_at,
  );
  const ready = sortedOrders.filter((o) => o.status === "ready");

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-xs text-muted">
        {t("kit.sound_hint")}
      </p>

      <div className="flex gap-1.5 rounded-xl bg-canvas p-1">
        <TabButton
          label={t("kit.tab.active")}
          count={pendingNew.length + pendingAccepted.length + ready.length}
          active={tab === "active"}
          onClick={() => setTab("active")}
        />
        <TabButton
          label={t("kit.tab.history")}
          active={tab === "history"}
          onClick={() => setTab("history")}
        />
      </div>

      {tab === "active" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Column
            title={t("kit.col.new")}
            count={pendingNew.length}
            tone="warning"
            orders={pendingNew}
            menuMap={menuMap}
            tableMap={tableMap}
            locale={locale}
            actions={
              canAct
                ? (o) => (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCancelTarget(o)}
                        disabled={busyId === o.id}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {t("kit.cancel")}
                      </button>
                      <button
                        onClick={() => acceptOrder(o)}
                        disabled={busyId === o.id}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-surface shadow-card transition hover:bg-sky-700 disabled:opacity-60"
                      >
                        {t("kit.accept_arrow")}
                      </button>
                    </div>
                  )
                : null
            }
          />
          <Column
            title={t("kit.col.in_progress")}
            count={pendingAccepted.length}
            tone="info"
            orders={pendingAccepted}
            menuMap={menuMap}
            tableMap={tableMap}
            locale={locale}
            memberEmails={memberEmails}
            showAcceptedBy
            actions={
              canAct
                ? (o) => (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCancelTarget(o)}
                        disabled={busyId === o.id}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {t("kit.cancel")}
                      </button>
                      <button
                        onClick={() => markReady(o)}
                        disabled={busyId === o.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-surface shadow-card transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {t("kit.done_arrow")}
                      </button>
                    </div>
                  )
                : null
            }
          />
          <Column
            title={t("kit.ready")}
            count={ready.length}
            tone="success"
            orders={ready}
            menuMap={menuMap}
            tableMap={tableMap}
            locale={locale}
            memberEmails={memberEmails}
            showCompletedBy
            actions={
              canAct
                ? (o) => (
                    <button
                      onClick={() => markServed(o)}
                      disabled={busyId === o.id}
                      className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-surface shadow-card transition hover:bg-ink/85 disabled:opacity-60"
                    >
                      {t("kit.served_check")}
                    </button>
                  )
                : null
            }
          />
        </div>
      ) : (
        <HistoryList
          orders={history}
          menuMap={menuMap}
          tableMap={tableMap}
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

interface ColumnProps {
  title: string;
  count: number;
  tone: "warning" | "info" | "success";
  orders: Order[];
  menuMap: Map<string, Menu>;
  tableMap: Map<string, DiningTable>;
  locale: ReturnType<typeof useT>["locale"];
  // null = read-only column (no buttons rendered)
  actions: ((o: Order) => React.ReactNode) | null;
  memberEmails?: Record<string, string>;
  showAcceptedBy?: boolean;
  showCompletedBy?: boolean;
}

const dotColor: Record<ColumnProps["tone"], string> = {
  warning: "bg-amber-400",
  info: "bg-sky-500",
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
  memberEmails,
  showAcceptedBy,
  showCompletedBy,
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
              {showAcceptedBy && order.accepted_by ? (
                <p className="text-[11px] text-muted">
                  {t("kit.col.accepted_by", {
                    email:
                      memberEmails?.[order.accepted_by] ?? order.accepted_by.slice(0, 8),
                  })}
                </p>
              ) : null}
              {showCompletedBy && order.completed_by ? (
                <p className="text-[11px] text-muted">
                  {t("kit.col.completed_by", {
                    email:
                      memberEmails?.[order.completed_by] ??
                      order.completed_by.slice(0, 8),
                  })}
                </p>
              ) : null}
              {actions ? (
                <div className="flex justify-end">{actions(order)}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface HistoryListProps {
  orders: Order[];
  menuMap: Map<string, Menu>;
  tableMap: Map<string, DiningTable>;
  locale: ReturnType<typeof useT>["locale"];
  memberEmails: Record<string, string>;
}

function HistoryList({
  orders,
  menuMap,
  tableMap,
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
