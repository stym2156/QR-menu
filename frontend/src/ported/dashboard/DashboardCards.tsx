"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import { formatKIP, formatTime } from "@/lib/format";
import type { OrderStatus, Restaurant, Role } from "@/lib/types";

interface RecentDashboardOrder {
  id: string;
  tableNumber: number | null;
  status: OrderStatus;
  total: number;
  paid: boolean;
  createdAt: string;
}

interface Props {
  restaurant: Restaurant | null;
  role: Role;
  todayRevenue: number;
  todayPaidCount: number;
  pendingCount: number;
  readyCount: number;
  servedCount: number;
  cancelledCount: number;
  unpaidTableCount: number;
  unpaidTotal: number;
  callCount: number;
  menuCount: number;
  availableMenuCount: number;
  unavailableMenuCount: number;
  categoryCount: number;
  tableCount: number;
  openTableCount: number;
  closedTableCount: number;
  activePromotionCount: number;
  scheduledPromotionCount: number;
  recentOrders: RecentDashboardOrder[];
}

export default function DashboardCards({
  restaurant,
  role,
  todayRevenue,
  todayPaidCount,
  pendingCount,
  readyCount,
  servedCount,
  cancelledCount,
  unpaidTableCount,
  unpaidTotal,
  callCount,
  menuCount,
  availableMenuCount,
  unavailableMenuCount,
  categoryCount,
  tableCount,
  openTableCount,
  closedTableCount,
  activePromotionCount,
  scheduledPromotionCount,
  recentOrders,
}: Props) {
  const { t } = useT();
  const isOwner = role === "owner";

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isOwner ? (
          <StatCard
            label={t("stat.today_sales")}
            value={formatKIP(todayRevenue)}
            sub={t("stat.paid_orders", { n: todayPaidCount })}
            href="/dashboard/stats"
          />
        ) : null}
        <StatCard
          label={t("stat.pending_orders")}
          value={String(pendingCount)}
          sub={t("stat.kitchen_pending")}
          href="/dashboard/kitchen"
          highlight={pendingCount > 0}
        />
        <StatCard
          label={t("stat.unpaid_tables")}
          value={String(unpaidTableCount)}
          sub={formatKIP(unpaidTotal)}
          href="/dashboard/bills"
          highlight={unpaidTableCount > 0}
        />
        <StatCard
          label={t("stat.calls")}
          value={String(callCount)}
          sub={t("stat.calls_waiting")}
          href="/dashboard/bills"
          highlight={callCount > 0}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {isOwner ? (
          <InfoPanel
            title={t("dash.panel.shop")}
            href="/dashboard/settings"
            rows={[
              {
                label: t("dash.shop.status"),
                value: restaurant?.accepting_orders ? t("dash.shop.open") : t("dash.shop.closed"),
                tone: restaurant?.accepting_orders ? "good" : "warn",
              },
              {
                label: t("dash.shop.hours"),
                value:
                  restaurant?.open_time && restaurant?.close_time
                    ? `${restaurant.open_time} - ${restaurant.close_time}`
                    : t("dash.shop.no_hours"),
              },
              {
                label: t("dash.shop.tax"),
                value: t("dash.shop.tax_value", {
                  service: restaurant?.service_charge_pct ?? 0,
                  vat: restaurant?.vat_pct ?? 0,
                }),
              },
            ]}
          />
        ) : null}
        <InfoPanel
          title={t("dash.panel.tables")}
          href="/dashboard/tables"
          rows={[
            { label: t("dash.tables.open"), value: openTableCount, tone: openTableCount > 0 ? "good" : undefined },
            { label: t("dash.tables.closed"), value: closedTableCount },
            { label: t("dash.tables.total"), value: tableCount },
          ]}
        />
        {isOwner ? (
          <>
            <InfoPanel
              title={t("dash.panel.menu")}
              href="/dashboard/menu"
              rows={[
                {
                  label: t("dash.menu.available"),
                  value: availableMenuCount,
                  tone: availableMenuCount > 0 ? "good" : undefined,
                },
                {
                  label: t("dash.menu.unavailable"),
                  value: unavailableMenuCount,
                  tone: unavailableMenuCount > 0 ? "warn" : undefined,
                },
                { label: t("dash.menu.categories"), value: categoryCount },
              ]}
            />
            <InfoPanel
              title={t("dash.panel.promotions")}
              href="/dashboard/promotions"
              rows={[
                {
                  label: t("dash.promos.active"),
                  value: activePromotionCount,
                  tone: activePromotionCount > 0 ? "good" : undefined,
                },
                { label: t("dash.promos.scheduled"), value: scheduledPromotionCount },
                { label: t("dash.promos.total"), value: activePromotionCount + scheduledPromotionCount },
              ]}
            />
          </>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t("dash.orders.title")}</h2>
              <p className="mt-1 text-xs text-muted">{t("dash.orders.desc")}</p>
            </div>
            <Link
              href="/dashboard/kitchen"
              prefetch={false}
              className="text-xs font-medium text-muted transition hover:text-ink"
            >
              {t("dash.view_kitchen")} -&gt;
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric label={t("dash.orders.pending")} value={pendingCount} highlight={pendingCount > 0} />
            <MiniMetric label={t("dash.orders.ready")} value={readyCount} highlight={readyCount > 0} />
            <MiniMetric label={t("dash.orders.served")} value={servedCount} />
            <MiniMetric label={t("dash.orders.cancelled")} value={cancelledCount} muted />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t("dash.recent.title")}</h2>
              <p className="mt-1 text-xs text-muted">{t("dash.recent.desc")}</p>
            </div>
            <Link
              href="/dashboard/bills"
              prefetch={false}
              className="text-xs font-medium text-muted transition hover:text-ink"
            >
              {t("dash.view_bills")} -&gt;
            </Link>
          </div>
          {recentOrders.length ? (
            <div className="mt-4 divide-y divide-line">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {order.tableNumber
                        ? t("dash.recent.table", { n: order.tableNumber })
                        : t("dash.recent.table_unknown")}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {formatTime(order.createdAt)} - {t(statusKey(order.status))}
                      {order.paid ? ` - ${t("dash.recent.paid")}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {formatKIP(order.total)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted">
              {t("dash.recent.empty")}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ResourceCard
          label={t("resource.menus")}
          count={menuCount}
          href="/dashboard/menu"
          cta={t("resource.cta.manage_menus")}
        />
        <ResourceCard
          label={t("resource.tables")}
          count={tableCount}
          href="/dashboard/tables"
          cta={t("resource.cta.manage_tables")}
        />
        <ResourceCard
          label={t("resource.categories")}
          count={categoryCount}
          href="/dashboard/categories"
          cta={t("resource.cta.manage_categories")}
        />
      </div>
    </>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  href: string;
  highlight?: boolean;
}

function StatCard({ label, value, sub, href, highlight }: StatCardProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group relative overflow-hidden rounded-2xl border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 ${
        highlight ? "border-ink/30" : "border-line"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
      {highlight ? <div className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-red-500" /> : null}
    </Link>
  );
}

interface ResourceCardProps {
  label: string;
  count: number | null;
  href: string;
  cta: string;
}

function ResourceCard({ label, count, href, cta }: ResourceCardProps) {
  const { t } = useT();
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-ink/30"
    >
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {count !== null ? <div className="mt-0.5 text-xs text-muted">{t("resource.count", { n: count })}</div> : null}
      </div>
      <span className="text-xs font-medium text-muted transition group-hover:text-ink">{cta} -&gt;</span>
    </Link>
  );
}

interface InfoPanelRow {
  label: string;
  value: string | number;
  tone?: "good" | "warn";
}

function InfoPanel({ title, href, rows }: { title: string; href: string; rows: InfoPanelRow[] }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-ink/30"
    >
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{row.label}</span>
            <span className={`font-medium tabular-nums ${toneClass(row.tone)}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

function MiniMetric({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line px-3 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${metricClass({ highlight, muted })}`}>{value}</div>
    </div>
  );
}

function toneClass(tone: InfoPanelRow["tone"]): string {
  if (tone === "good") return "text-emerald-700";
  if (tone === "warn") return "text-amber-700";
  return "text-ink";
}

function metricClass({ highlight, muted }: { highlight?: boolean; muted?: boolean }): string {
  if (highlight) return "text-red-600";
  if (muted) return "text-muted";
  return "text-ink";
}

function statusKey(status: OrderStatus): string {
  return `dash.status.${status}`;
}
