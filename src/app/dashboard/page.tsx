import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { formatKIP } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import StatsPage from "./stats/page";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (membership?.role === "staff") redirect("/dashboard/kitchen");

  const restaurantId = membership?.restaurantId ?? "";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: menuCount },
    { count: tableCount },
    { count: pendingCount },
    { count: callCount },
    { data: todayPaid },
    { data: unpaidOrders },
  ] = await Promise.all([
    supabase
      .from("menus")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("tables")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending"),
    supabase
      .from("call_staff_requests")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("acknowledged", false),
    supabase
      .from("orders")
      .select("total")
      .eq("restaurant_id", restaurantId)
      .eq("paid", true)
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("table_id, total")
      .eq("restaurant_id", restaurantId)
      .eq("paid", false),
  ]);

  const todayRevenue = (todayPaid ?? []).reduce(
    (sum, o) => sum + Number(o.total),
    0,
  );

  const unpaidTableCount = new Set((unpaidOrders ?? []).map((o) => o.table_id)).size;
  const unpaidTotal = (unpaidOrders ?? []).reduce(
    (sum, o) => sum + Number(o.total),
    0,
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ยอดขายวันนี้"
          value={formatKIP(todayRevenue)}
          sub={`${todayPaid?.length ?? 0} ออเดอร์ที่ชำระแล้ว`}
          href="/dashboard/stats"
        />
        <StatCard
          label="ออเดอร์รอทำ"
          value={String(pendingCount ?? 0)}
          sub="ที่ครัวต้องทำ"
          href="/dashboard/kitchen"
          highlight={!!(pendingCount && pendingCount > 0)}
        />
        <StatCard
          label="โต๊ะค้างบิล"
          value={String(unpaidTableCount)}
          sub={formatKIP(unpaidTotal)}
          href="/dashboard/bills"
          highlight={unpaidTableCount > 0}
        />
        <StatCard
          label="ลูกค้าเรียก"
          value={String(callCount ?? 0)}
          sub="รอรับทราบ"
          href="/dashboard/kitchen"
          highlight={!!(callCount && callCount > 0)}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ResourceCard
          label="เมนู"
          count={menuCount ?? 0}
          href="/dashboard/menu"
          cta="จัดการเมนู"
        />
        <ResourceCard
          label="โต๊ะ + QR"
          count={tableCount ?? 0}
          href="/dashboard/tables"
          cta="จัดการโต๊ะ"
        />
        <ResourceCard
          label="หมวดหมู่"
          count={null}
          href="/dashboard/categories"
          cta="จัดการหมวด"
        />
      </div>
      <div className="mt-10">
        <StatsPage />
      </div>

    </div>
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
      className={`group relative overflow-hidden rounded-2xl border bg-surface p-5 transition hover:shadow-card ${highlight ? "border-ink/30" : "border-line"
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
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-ink/30 hover:shadow-card"
    >
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {count !== null ? (
          <div className="mt-0.5 text-xs text-muted">{count} รายการ</div>
        ) : null}
      </div>
      <span className="text-xs font-medium text-muted transition group-hover:text-ink">
        {cta} →
      </span>
    </Link>
  );
}
