"use client";

import { useMemo, useState } from "react";
import { formatKIP } from "@/lib/format";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { Menu, Order, PaymentMethod } from "@/lib/types";

interface Props {
  orders: Order[];
  menus: Menu[];
}

type Preset = "today" | "yesterday" | "7d" | "30d" | "custom";

interface ItemAggregate {
  menuId: string;
  name: string;
  qty: number;
  revenue: number;
  orderCount: number;
}

export default function CloseShopView({ orders, menus }: Props) {
  const { t, locale } = useT();
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(toLocalDate(new Date()));
  const [customTo, setCustomTo] = useState(toLocalDate(new Date()));

  const { from, to } = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const inRange = useMemo(
    () =>
      orders.filter((o) => {
        const t = o.paid_at ?? o.created_at;
        return t >= from.toISOString() && t < to.toISOString();
      }),
    [orders, from, to],
  );

  // ── KPIs ────────────────────────────────────────────────────────
  const totalRevenue = inRange.reduce((s, o) => s + Number(o.total), 0);
  const orderCount = inRange.length;
  const tableCount = new Set(inRange.map((o) => o.table_id)).size;
  const avgPerOrder = orderCount > 0 ? totalRevenue / orderCount : 0;

  // ── Payment method breakdown ────────────────────────────────────
  const paymentBreakdown = useMemo(() => {
    const map = new Map<PaymentMethod, { count: number; total: number }>();
    for (const o of inRange) {
      const method = (o.payment_method ?? "other") as PaymentMethod;
      const cur = map.get(method) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(o.total);
      map.set(method, cur);
    }
    return Array.from(map.entries())
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [inRange]);

  // ── Per-item aggregate (best / worst sellers) ───────────────────
  const itemAgg = useMemo<ItemAggregate[]>(() => {
    const map = new Map<string, ItemAggregate>();
    for (const o of inRange) {
      for (const item of o.items ?? []) {
        const menu = menuMap.get(item.menu_id);
        const name = menu ? pickName(menu, locale) : t("close.unknown_menu");
        const price = menu?.price ?? 0;
        const entry = map.get(item.menu_id) ?? {
          menuId: item.menu_id,
          name,
          qty: 0,
          revenue: 0,
          orderCount: 0,
        };
        entry.qty += item.qty;
        entry.revenue += price * item.qty;
        entry.orderCount += 1;
        map.set(item.menu_id, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [inRange, menuMap, locale, t]);

  const topSellers = itemAgg.slice(0, 10);
  const worstSellers = useMemo(() => {
    // Include menus that had zero sales in range too — those are the real
    // "worst sellers" worth noticing.
    const sold = new Set(itemAgg.map((a) => a.menuId));
    const zeroes: ItemAggregate[] = menus
      .filter((m) => !sold.has(m.id) && m.available)
      .map((m) => ({
        menuId: m.id,
        name: pickName(m, locale),
        qty: 0,
        revenue: 0,
        orderCount: 0,
      }));
    return [...zeroes, ...itemAgg.slice().reverse()].slice(0, 10);
  }, [itemAgg, menus, locale]);

  // ── Exports ─────────────────────────────────────────────────────
  function exportOrders(): void {
    const csv = buildCsv(inRange, [
      { header: "order_id", value: (o) => o.id },
      { header: "table_id", value: (o) => o.table_id },
      { header: "paid_at", value: (o) => o.paid_at ?? o.created_at },
      { header: "payment_method", value: (o) => o.payment_method ?? "" },
      { header: "total", value: (o) => o.total },
      { header: "item_count", value: (o) => (o.items ?? []).length },
    ]);
    const fname = `orders_${toLocalDate(from)}_to_${toLocalDate(to)}`;
    downloadCsv(fname, csv);
  }

  function exportItems(): void {
    const csv = buildCsv(itemAgg, [
      { header: "menu_id", value: (i) => i.menuId },
      { header: "name", value: (i) => i.name },
      { header: "qty_sold", value: (i) => i.qty },
      { header: "revenue", value: (i) => i.revenue },
      { header: "appeared_in_orders", value: (i) => i.orderCount },
    ]);
    const fname = `items_${toLocalDate(from)}_to_${toLocalDate(to)}`;
    downloadCsv(fname, csv);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("close.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("close.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportOrders}
            disabled={inRange.length === 0}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-50"
          >
            {t("close.export.orders")}
          </button>
          <button
            onClick={exportItems}
            disabled={itemAgg.length === 0}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-50"
          >
            {t("close.export.items")}
          </button>
        </div>
      </header>

      {/* Date range presets + custom */}
      <div className="flex flex-wrap items-center gap-2">
        {(["today", "yesterday", "7d", "30d", "custom"] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              preset === p
                ? "bg-ink text-surface"
                : "bg-canvas text-muted hover:bg-line hover:text-ink"
            }`}
          >
            {t(`close.preset.${p}`)}
          </button>
        ))}
        {preset === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
            />
            <span className="text-xs text-muted">→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
            />
          </div>
        ) : null}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label={t("close.kpi.revenue")}
          value={formatKIP(totalRevenue)}
          accent="emerald"
        />
        <Kpi label={t("close.kpi.orders")} value={orderCount.toString()} />
        <Kpi label={t("close.kpi.tables")} value={tableCount.toString()} />
        <Kpi
          label={t("close.kpi.avg")}
          value={formatKIP(Math.round(avgPerOrder))}
        />
      </div>

      {/* Payment breakdown */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          {t("close.section.payment")}
        </h2>
        {paymentBreakdown.length === 0 ? (
          <p className="text-sm text-muted">{t("close.empty.payment")}</p>
        ) : (
          <ul className="space-y-2">
            {paymentBreakdown.map((p) => {
              const pct = totalRevenue > 0 ? (p.total / totalRevenue) * 100 : 0;
              return (
                <li key={p.method} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">
                      {t(`bill.settled.method.${p.method}`)}{" "}
                      <span className="text-muted">· {p.count}</span>
                    </span>
                    <span className="tabular-nums text-ink">
                      {formatKIP(p.total)}{" "}
                      <span className="text-xs text-muted">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                    <div
                      className="h-full bg-ink transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Top + Worst sellers side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SellerTable
          title={t("close.section.best")}
          rows={topSellers}
          emptyKey="close.empty.items"
          showRevenue
        />
        <SellerTable
          title={t("close.section.worst")}
          rows={worstSellers}
          emptyKey="close.empty.items"
          showRevenue
          tone="muted"
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div
      className={`rounded-2xl border bg-surface p-4 ${
        accent === "emerald" ? "border-emerald-200" : "border-line"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}

interface SellerTableProps {
  title: string;
  rows: ItemAggregate[];
  emptyKey: string;
  showRevenue?: boolean;
  tone?: "muted";
}

function SellerTable({ title, rows, emptyKey, showRevenue, tone }: SellerTableProps) {
  const { t } = useT();
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t(emptyKey)}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row, idx) => (
            <li
              key={row.menuId}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">
                  {idx + 1}.
                </span>
                <span
                  className={`min-w-0 truncate ${tone === "muted" ? "text-muted" : "text-ink"}`}
                >
                  {row.name}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="tabular-nums text-ink">×{row.qty}</span>
                {showRevenue && row.revenue > 0 ? (
                  <span className="ml-2 text-xs tabular-nums text-muted">
                    {formatKIP(row.revenue)}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function toLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolveRange(
  preset: Preset,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "custom": {
      return {
        from: startOfDay(new Date(customFrom)),
        to: endOfDay(new Date(customTo)),
      };
    }
  }
}
