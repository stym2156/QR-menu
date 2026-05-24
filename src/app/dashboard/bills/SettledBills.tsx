"use client";

import { useMemo, useState } from "react";
import { formatKIP, formatTime } from "@/lib/format";
import { EmptyState, buttonSecondary } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import { printReceipt } from "./receipt";
import { BluetoothPrinterButton } from "./BluetoothPrinterButton";
import type {
  DiningTable,
  Menu,
  Order,
  PaymentMethod,
} from "@/lib/types";

type RangeKey = "today" | "yesterday" | "7d" | "30d";

const RANGE_KEY: Record<RangeKey, string> = {
  today: "bill.range.today",
  yesterday: "bill.range.yesterday",
  "7d": "bill.range.7d",
  "30d": "bill.range.30d",
};

const PAYMENT_ICON: Record<PaymentMethod, string> = {
  cash: "💵",
  promptpay: "📱",
  transfer: "🏦",
  card: "💳",
  other: "•",
};

interface SettledBill {
  key: string;
  table: DiningTable | undefined;
  paidAt: string;
  method: PaymentMethod;
  orders: Order[];
  total: number;
  itemCount: number;
}

interface Props {
  settledOrders: Order[];
  tables: DiningTable[];
  menus: Menu[];
  restaurantName: string;
  serviceChargePct: number;
  vatPct: number;
  paymentQrUrl: string | null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeBounds(range: RangeKey): { start: number; end: number } {
  const now = Date.now();
  if (range === "today") {
    return { start: startOfDay(new Date()).getTime(), end: now };
  }
  if (range === "yesterday") {
    const today = startOfDay(new Date()).getTime();
    return { start: today - 86_400_000, end: today };
  }
  if (range === "7d") {
    return {
      start: startOfDay(new Date(now - 6 * 86_400_000)).getTime(),
      end: now,
    };
  }
  return {
    start: startOfDay(new Date(now - 29 * 86_400_000)).getTime(),
    end: now,
  };
}

export default function SettledBills({
  settledOrders,
  tables,
  menus,
  restaurantName,
  serviceChargePct,
  vatPct,
  paymentQrUrl,
}: Props) {
  const { t, locale } = useT();
  const [range, setRange] = useState<RangeKey>("today");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tableMap = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  const bills = useMemo<SettledBill[]>(() => {
    const { start, end } = rangeBounds(range);
    // Group by (table_id, paid_at) — orders settled together share paid_at.
    const groups = new Map<string, Order[]>();
    for (const o of settledOrders) {
      if (!o.paid_at) continue;
      const t = new Date(o.paid_at).getTime();
      if (t < start || t > end) continue;
      const key = `${o.table_id}|${o.paid_at}`;
      const arr = groups.get(key) ?? [];
      arr.push(o);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .map<SettledBill>(([key, list]) => {
        const first = list[0];
        return {
          key,
          table: tableMap.get(first.table_id),
          paidAt: first.paid_at!,
          method: (first.payment_method ?? "other") as PaymentMethod,
          orders: list,
          total: list.reduce((s, o) => s + Number(o.total), 0),
          itemCount: list.reduce(
            (s, o) => s + o.items.reduce((q, it) => q + it.qty, 0),
            0,
          ),
        };
      })
      .sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
  }, [settledOrders, range, tableMap]);

  const totalRevenue = bills.reduce((s, b) => s + b.total, 0);
  const totalItems = bills.reduce((s, b) => s + b.itemCount, 0);
  const tableCount = new Set(bills.map((b) => b.table?.id ?? "")).size;

  function toggleExpand(key: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function reprint(bill: SettledBill): void {
    if (!bill.table) return;
    printReceipt({
      restaurantName,
      tableNumber: bill.table.table_number,
      orders: bill.orders,
      menus,
      method: bill.method,
      paidAt: bill.paidAt,
      serviceChargePct,
      vatPct,
      paymentQrUrl,
      locale,
    });
  }

  return (
    <div className="space-y-4">
      {/* Date range chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(RANGE_KEY) as RangeKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setRange(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              range === k
                ? "bg-ink text-surface"
                : "border border-line bg-surface text-ink hover:border-ink/30 hover:bg-canvas"
            }`}
          >
            {t(RANGE_KEY[k])}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label={t("bill.settled.tables")} value={String(tableCount)} />
        <SummaryCard label={t("bill.settled.count")} value={String(bills.length)} />
        <SummaryCard label={t("bill.settled.revenue")} value={formatKIP(totalRevenue)} highlight />
      </div>
      <div className="rounded-xl border border-line bg-canvas/40 px-4 py-2 text-xs text-muted">
        {t("bill.settled.avg", {
          items: totalItems,
          avg:
            bills.length > 0
              ? formatKIP(Math.round(totalRevenue / bills.length))
              : formatKIP(0),
        })}
      </div>

      {/* Bill list */}
      {bills.length === 0 ? (
        <EmptyState
          title={t("bill.settled.empty", { range: t(RANGE_KEY[range]) })}
          description={t("bill.settled.empty.desc")}
        />
      ) : (
        <ul className="space-y-2">
          {bills.map((bill) => {
            const isOpen = expanded.has(bill.key);
            return (
              <li
                key={bill.key}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(bill.key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-canvas/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-sm font-semibold tabular-nums text-surface">
                    {bill.table?.table_number ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {t("kit.calls.table_n", { n: bill.table?.table_number ?? "?" })}
                      </span>
                      <span className="text-base font-semibold tabular-nums tracking-tight text-ink">
                        {formatKIP(bill.total)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      <span>{formatBillDateTime(bill.paidAt, t)}</span>
                      <span>·</span>
                      <span>
                        {PAYMENT_ICON[bill.method]} {t(`bill.settled.method.${bill.method}`)}
                      </span>
                      <span>·</span>
                      <span>{t("bill.unpaid.items_n", { n: bill.itemCount })}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-line bg-canvas/30 px-4 py-3">
                    <ul className="space-y-1.5">
                      {bill.orders.flatMap((order) =>
                        order.items.map((item, i) => {
                          const menu = menuMap.get(item.menu_id);
                          const unit = menu?.price ?? 0;
                          const lineTotal = unit * item.qty;
                          const name = menu ? pickName(menu, locale) : t("kit.no_menu");
                          return (
                            <li
                              key={`${order.id}-${i}`}
                              className="flex items-baseline justify-between gap-2 text-sm"
                            >
                              <span className="min-w-0 flex-1 text-ink">
                                {name}{" "}
                                <span className="text-muted">×{item.qty}</span>
                                {item.note ? (
                                  <div className="text-xs text-muted">
                                    📝 {item.note}
                                  </div>
                                ) : null}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted">
                                {formatKIP(lineTotal)}
                              </span>
                            </li>
                          );
                        }),
                      )}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      {bill.table ? (
                        <BluetoothPrinterButton
                          variant="compact"
                          job={{
                            restaurantName,
                            tableNumber: bill.table.table_number,
                            orders: bill.orders,
                            menus,
                            method: bill.method,
                            paidAt: bill.paidAt,
                            serviceChargePct,
                            vatPct,
                            locale,
                          }}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => reprint(bill)}
                        className={`${buttonSecondary} py-1.5 text-xs`}
                      >
                        {t("bill.settled.print_again")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function SummaryCard({ label, value, highlight }: SummaryCardProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight ? "border-ink/20 bg-ink/[0.03]" : "border-line bg-surface"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}

function formatBillDateTime(
  iso: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const d = new Date(iso);
  const today = startOfDay(new Date()).getTime();
  const yesterday = today - 86_400_000;
  const ts = d.getTime();
  if (ts >= today) return formatTime(iso);
  if (ts >= yesterday) {
    return t("bill.range.yesterday_at", { time: formatTime(iso) });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
