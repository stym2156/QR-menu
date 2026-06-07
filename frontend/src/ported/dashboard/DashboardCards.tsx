"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import { formatKIP } from "@/lib/format";

interface Props {
  todayRevenue: number;
  todayPaidCount: number;
  pendingCount: number;
  unpaidTableCount: number;
  unpaidTotal: number;
  callCount: number;
  menuCount: number;
  tableCount: number;
}

export default function DashboardCards({
  todayRevenue,
  todayPaidCount,
  pendingCount,
  unpaidTableCount,
  unpaidTotal,
  callCount,
  menuCount,
  tableCount,
}: Props) {
  const { t } = useT();

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("stat.today_sales")}
          value={formatKIP(todayRevenue)}
          sub={t("stat.paid_orders", { n: todayPaidCount })}
          href="/dashboard/stats"
        />
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
          href="/dashboard/kitchen"
          highlight={callCount > 0}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          count={null}
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
      className={`group relative overflow-hidden rounded-2xl border bg-surface p-5 transition hover:shadow-card ${
        highlight ? "border-ink/30" : "border-line"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
      {highlight ? (
        <div className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-red-500" />
      ) : null}
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
      className="group flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-ink/30 hover:shadow-card"
    >
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {count !== null ? (
          <div className="mt-0.5 text-xs text-muted">
            {t("resource.count", { n: count })}
          </div>
        ) : null}
      </div>
      <span className="text-xs font-medium text-muted transition group-hover:text-ink">
        {cta} →
      </span>
    </Link>
  );
}
