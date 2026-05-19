"use client";

import { useMemo } from "react";
import { formatKIP } from "@/lib/format";
import { EmptyState, SectionHeading, card, cardPad } from "@/components/ui";
import type { Menu, Order } from "@/lib/types";

interface Props {
  orders: Order[];
  menus: Menu[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function StatsView({ orders, menus }: Props) {
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  const stats = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const weekStart = startOfDay(new Date(Date.now() - 6 * 86_400_000)).getTime();

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

  if (!hasData) {
    return (
      <EmptyState
        title="ยังไม่มีข้อมูลยอดขาย"
        description="เมื่อมีการรับชำระบิล สถิติจะปรากฏที่นี่ภายในไม่กี่วินาที"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="ยอดวันนี้"
          revenue={stats.todayRevenue}
          orders={stats.todayOrders}
        />
        <Stat
          label="ยอด 7 วัน"
          revenue={stats.weekRevenue}
          orders={stats.weekOrders}
        />
        <Stat
          label="ยอด 30 วัน"
          revenue={stats.monthRevenue}
          orders={stats.monthOrders}
        />
      </div>

      <div className={`${card} ${cardPad}`}>
        <SectionHeading
          title="ยอดขายรายวัน"
          description="7 วันล่าสุด"
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
        <SectionHeading title="เมนูขายดี" description="Top 10 ใน 30 วัน" />
        {stats.topMenus.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>
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
                        {row.menu.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {row.qty} จาน · {formatKIP(row.revenue)}
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

interface StatProps {
  label: string;
  revenue: number;
  orders: number;
}

function Stat({ label, revenue, orders }: StatProps) {
  return (
    <div className={`${card} ${cardPad}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">
        {formatKIP(revenue)}
      </div>
      <div className="mt-1 text-xs text-muted">{orders} ออเดอร์</div>
    </div>
  );
}
