"use client";

import { useMemo, useState } from "react";
import { formatKIP, formatDateTime } from "@/lib/format";
import { EmptyState, SectionHeading, card, cardPad } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { Category, Menu, Order } from "@/lib/types";

interface Props {
  orders: Order[];
  menus: Menu[];
  categories: Category[];
}

type RangeKey = "today" | "7d" | "30d";

const RANGE_KEY: Record<RangeKey, string> = {
  today: "stats.range.today",
  "7d": "stats.range.7d",
  "30d": "stats.range.30d",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeStart(key: RangeKey): number {
  if (key === "today") return startOfDay(new Date()).getTime();
  if (key === "7d") return startOfDay(new Date(Date.now() - 6 * 86_400_000)).getTime();
  return startOfDay(new Date(Date.now() - 29 * 86_400_000)).getTime();
}

export default function StatsView({ orders, menus, categories }: Props) {
  const { t, locale } = useT();
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [activeRange, setActiveRange] = useState<RangeKey | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const stats = useMemo(() => {
    const todayStart = rangeStart("today");
    const weekStart = rangeStart("7d");

    let todayRevenue = 0;
    let todayOrders = 0;
    let weekRevenue = 0;
    let weekOrders = 0;
    let monthRevenue = 0;
    let monthOrders = 0;

    const byDay = new Map<string, { revenue: number; orders: number }>();
    const byMenu = new Map<string, { qty: number; revenue: number }>();

    for (const order of orders) {
      const t = new Date(order.created_at).getTime();
      const total = Number(order.total);
      monthRevenue += total;
      monthOrders += 1;

      if (t >= weekStart) {
        weekRevenue += total;
        weekOrders += 1;
      }
      if (t >= todayStart) {
        todayRevenue += total;
        todayOrders += 1;
      }

      const dayKey = new Date(order.created_at).toLocaleDateString("th-TH", {
        month: "short",
        day: "numeric",
      });
      const dayBucket = byDay.get(dayKey) ?? { revenue: 0, orders: 0 };
      dayBucket.revenue += total;
      dayBucket.orders += 1;
      byDay.set(dayKey, dayBucket);

      for (const item of order.items) {
        const menu = menuMap.get(item.menu_id);
        if (!menu) continue;
        const bucket = byMenu.get(item.menu_id) ?? { qty: 0, revenue: 0 };
        bucket.qty += item.qty;
        bucket.revenue += item.qty * Number(menu.price);
        byMenu.set(item.menu_id, bucket);
      }
    }

    const last7Days: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
      const bucket = byDay.get(key) ?? { revenue: 0, orders: 0 };
      last7Days.push({ date: key, revenue: bucket.revenue, orders: bucket.orders });
    }

    const topMenus = Array.from(byMenu.entries())
      .map(([id, b]) => ({ menu: menuMap.get(id), ...b }))
      .filter((x): x is { menu: Menu; qty: number; revenue: number } => Boolean(x.menu))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    return {
      todayRevenue,
      todayOrders,
      weekRevenue,
      weekOrders,
      monthRevenue,
      monthOrders,
      last7Days,
      topMenus,
    };
  }, [orders, menuMap]);

  const maxRevenue = Math.max(1, ...stats.last7Days.map((d) => d.revenue));
  const hasData = orders.length > 0;

  function toggleRange(r: RangeKey): void {
    setActiveRange((cur) => (cur === r ? null : r));
    setCategoryFilter(null);
  }

  if (!hasData) {
    return (
      <EmptyState
        title={t("stats.empty.title")}
        description={t("stats.empty.desc")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatButton
          label={t("stats.today")}
          revenue={stats.todayRevenue}
          orders={stats.todayOrders}
          active={activeRange === "today"}
          onClick={() => toggleRange("today")}
        />
        <StatButton
          label={t("stats.week")}
          revenue={stats.weekRevenue}
          orders={stats.weekOrders}
          active={activeRange === "7d"}
          onClick={() => toggleRange("7d")}
        />
        <StatButton
          label={t("stats.month")}
          revenue={stats.monthRevenue}
          orders={stats.monthOrders}
          active={activeRange === "30d"}
          onClick={() => toggleRange("30d")}
        />
      </div>

      {activeRange ? (
        <OrderDetailPanel
          range={activeRange}
          orders={orders}
          menus={menus}
          menuMap={menuMap}
          categories={categories}
          categoryMap={categoryMap}
          categoryFilter={categoryFilter}
          onChangeCategory={setCategoryFilter}
          onClose={() => {
            setActiveRange(null);
            setCategoryFilter(null);
          }}
        />
      ) : null}

      <div className={`${card} ${cardPad}`}>
        <SectionHeading
          title={t("stats.daily.title")}
          description={t("stats.daily.desc")}
        />
        <div className="flex h-52 items-end justify-between gap-2 pt-4">
          {stats.last7Days.map((d) => {
            const heightPct = (d.revenue / maxRevenue) * 100;
            const isToday = d.date === stats.last7Days[stats.last7Days.length - 1].date;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-[11px] font-medium tabular-nums text-muted">
                  {d.revenue > 0
                    ? formatKIP(d.revenue).replace("₭", "").replace(".00", "")
                    : "—"}
                </div>
                <div className="flex h-full w-full items-end">
                  <div
                    className={`w-full rounded-md transition-all ${
                      isToday ? "bg-ink" : "bg-line"
                    }`}
                    style={{
                      height: `${heightPct}%`,
                      minHeight: d.revenue > 0 ? 4 : 0,
                    }}
                    title={`${d.date}: ${formatKIP(d.revenue)} (${d.orders} ออเดอร์)`}
                  />
                </div>
                <div
                  className={`text-[11px] tabular-nums ${
                    isToday ? "font-medium text-ink" : "text-muted"
                  }`}
                >
                  {d.date}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${card} ${cardPad}`}>
        <SectionHeading title={t("stats.top.title")} description={t("stats.top.desc")} />
        {stats.topMenus.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("stats.top.empty")}</p>
        ) : (
          <ol className="space-y-2">
            {stats.topMenus.map((row, idx) => {
              const maxQty = stats.topMenus[0].qty;
              const barPct = (row.qty / maxQty) * 100;
              return (
                <li
                  key={row.menu.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-canvas"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-semibold tabular-nums text-ink">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {pickName(row.menu, locale)}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {t("stats.top.qty_revenue", { qty: row.qty, revenue: formatKIP(row.revenue) })}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-ink"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

interface StatButtonProps {
  label: string;
  revenue: number;
  orders: number;
  active: boolean;
  onClick: () => void;
}

function StatButton({ label, revenue, orders, active, onClick }: StatButtonProps) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${card} ${cardPad} text-left transition hover:border-ink/30 ${
        active ? "border-ink/40 ring-2 ring-ink/10" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">
          {label}
        </div>
        <span className={`text-xs ${active ? "text-ink" : "text-muted"}`}>
          {active ? t("stats.hide") : t("stats.view_detail")}
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">
        {formatKIP(revenue)}
      </div>
      <div className="mt-1 text-xs text-muted">{t("stats.orders_n", { n: orders })}</div>
    </button>
  );
}

interface OrderDetailPanelProps {
  range: RangeKey;
  orders: Order[];
  menus: Menu[];
  menuMap: Map<string, Menu>;
  categories: Category[];
  categoryMap: Map<string, Category>;
  categoryFilter: string | null;
  onChangeCategory: (id: string | null) => void;
  onClose: () => void;
}

function OrderDetailPanel({
  range,
  orders,
  menuMap,
  categories,
  categoryMap,
  categoryFilter,
  onChangeCategory,
  onClose,
}: OrderDetailPanelProps) {
  const { t, locale } = useT();
  // Build menu→category lookup once.
  const menuCategoryOf = (menuId: string): string | null =>
    menuMap.get(menuId)?.category_id ?? null;

  const filtered = useMemo(() => {
    const start = rangeStart(range);
    const result: {
      order: Order;
      filteredItems: { menu: Menu; qty: number; lineTotal: number; note?: string }[];
      filteredTotal: number;
    }[] = [];

    for (const order of orders) {
      const t = new Date(order.created_at).getTime();
      if (t < start) continue;

      const items: { menu: Menu; qty: number; lineTotal: number; note?: string }[] = [];
      let lineSum = 0;
      for (const it of order.items) {
        const menu = menuMap.get(it.menu_id);
        if (!menu) continue;
        if (categoryFilter && menu.category_id !== categoryFilter) continue;
        const lineTotal = Number(menu.price) * it.qty;
        items.push({ menu, qty: it.qty, lineTotal, note: it.note });
        lineSum += lineTotal;
      }
      if (items.length === 0) continue;
      result.push({
        order,
        filteredItems: items,
        // When no category filter, use stored total (includes any historical pricing).
        // When filtering, use re-computed line sum so totals make sense.
        filteredTotal: categoryFilter ? lineSum : Number(order.total),
      });
    }
    return result;
  }, [orders, range, menuMap, categoryFilter]);

  // Categories that actually appear in this range — hide noise.
  const availableCategories = useMemo(() => {
    const ids = new Set<string>();
    const start = rangeStart(range);
    for (const o of orders) {
      if (new Date(o.created_at).getTime() < start) continue;
      for (const it of o.items) {
        const cid = menuCategoryOf(it.menu_id);
        if (cid) ids.add(cid);
      }
    }
    return categories.filter((c) => ids.has(c.id));
    // menuCategoryOf depends on menuMap; orders/range/categories cover the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, range, categories, menuMap]);

  const totalRevenue = filtered.reduce((s, r) => s + r.filteredTotal, 0);
  const totalItems = filtered.reduce(
    (s, r) => s + r.filteredItems.reduce((q, i) => q + i.qty, 0),
    0,
  );

  return (
    <div className={`${card} ${cardPad} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            {t("stats.detail.title", { range: t(RANGE_KEY[range]) })}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {t("stats.detail.summary", {
              orders: filtered.length,
              items: totalItems,
              revenue: formatKIP(totalRevenue),
            })}
            {categoryFilter ? t("stats.detail.filtered") : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2.5 py-1.5 text-xs text-muted transition hover:bg-canvas hover:text-ink"
        >
          {t("stats.detail.close")}
        </button>
      </div>

      {availableCategories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            label={t("common.all")}
            active={!categoryFilter}
            onClick={() => onChangeCategory(null)}
          />
          {availableCategories.map((c) => (
            <CategoryChip
              key={c.id}
              label={pickName(c, locale)}
              active={categoryFilter === c.id}
              onClick={() => onChangeCategory(c.id)}
            />
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {categoryFilter
            ? t("stats.detail.empty_filtered", {
                name: categoryMap.get(categoryFilter)
                  ? pickName(categoryMap.get(categoryFilter)!, locale)
                  : "",
              })
            : t("stats.detail.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map(({ order, filteredItems, filteredTotal }) => (
            <li key={order.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between text-xs text-muted">
                <span>{formatDateTime(order.created_at)}</span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatKIP(filteredTotal)}
                </span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {filteredItems.map((it, i) => (
                  <li
                    key={`${order.id}-${i}`}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 text-ink">
                      {pickName(it.menu, locale)}{" "}
                      <span className="text-muted">×{it.qty}</span>
                      {it.note ? (
                        <span className="ml-1 text-xs text-muted">— {it.note}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {formatKIP(it.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface CategoryChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function CategoryChip({ label, active, onClick }: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-ink text-surface"
          : "border border-line bg-surface text-ink hover:border-ink/30 hover:bg-canvas"
      }`}
    >
      {label}
    </button>
  );
}
