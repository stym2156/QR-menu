import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "open" | "closed";

interface RestaurantRow {
  id: string;
  name: string;
  user_id: string;
  accepting_orders: boolean;
  created_at: string;
  service_charge_pct: number;
  vat_pct: number;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const params = await searchParams;
  const rawStatus = params.status;
  const status: StatusFilter =
    rawStatus === "open" || rawStatus === "closed" ? rawStatus : "all";

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select(
      "id, name, user_id, accepting_orders, created_at, service_charge_pct, vat_pct",
    )
    .order("created_at", { ascending: false });

  const allRows = (restaurants ?? []) as RestaurantRow[];
  const openCount = allRows.filter((r) => r.accepting_orders).length;
  const closedCount = allRows.length - openCount;
  const rows = allRows.filter((r) => {
    if (status === "open") return r.accepting_orders;
    if (status === "closed") return !r.accepting_orders;
    return true;
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            ร้านทั้งหมดในระบบ
          </h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} จาก {allRows.length} ร้าน · เรียงใหม่→เก่า ·
            คลิกเพื่อดูรายละเอียดและแก้ไข
          </p>
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="กรองสถานะร้าน">
          <FilterTab
            href="/admin"
            label={`ทั้งหมด (${allRows.length})`}
            active={status === "all"}
          />
          <FilterTab
            href="/admin?status=open"
            label={`เปิดอยู่ (${openCount})`}
            active={status === "open"}
            tone="success"
          />
          <FilterTab
            href="/admin?status=closed"
            label={`ปิดอยู่ (${closedCount})`}
            active={status === "closed"}
            tone="muted"
          />
        </nav>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center text-sm text-muted">
          {allRows.length === 0
            ? "ยังไม่มีร้านในระบบ"
            : "ไม่มีร้านที่ตรงกับเงื่อนไข"}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/restaurants/${r.id}`}
                className="group block h-full rounded-2xl border border-line bg-surface p-4 transition hover:border-ink/30 hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 text-base font-semibold tracking-tight text-ink">
                    {r.name || "(ไม่มีชื่อร้าน)"}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                      r.accepting_orders
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-muted/10 text-muted"
                    }`}
                  >
                    {r.accepting_orders ? "เปิด" : "ปิด"}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  <div className="flex items-center justify-between gap-2">
                    <span>สร้างเมื่อ</span>
                    <span className="tabular-nums">
                      {formatDateTime(r.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Service / VAT</span>
                    <span className="tabular-nums">
                      {Number(r.service_charge_pct)}% / {Number(r.vat_pct)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Restaurant ID</span>
                    <span className="truncate font-mono text-[10px]">
                      {r.id.slice(0, 8)}…
                    </span>
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-600 transition group-hover:gap-1.5">
                  รายละเอียด →
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FilterTabProps {
  href: string;
  label: string;
  active: boolean;
  tone?: "default" | "success" | "muted";
}

function FilterTab({ href, label, active, tone = "default" }: FilterTabProps) {
  const activeClasses =
    tone === "success"
      ? "border-emerald-300 bg-emerald-500 text-surface"
      : tone === "muted"
        ? "border-muted/40 bg-muted/80 text-surface"
        : "border-ink bg-ink text-surface";
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? activeClasses
          : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
