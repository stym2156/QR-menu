import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import AdminRestaurantForm from "./AdminRestaurantForm";
import type { Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!restaurant) notFound();
  const r = restaurant as Restaurant;

  // Fetch owner stats — counts only, not the menu data itself (per spec).
  const [
    { count: menuCount },
    { count: tableCount },
    { count: orderCount },
    { count: feedbackCount },
  ] = await Promise.all([
    supabase
      .from("menus")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", id),
    supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", id),
    supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted transition hover:text-ink"
        >
          ← กลับ
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
          {r.name || "(ไม่มีชื่อร้าน)"}
        </h1>
        <p className="mt-1 text-xs text-muted">
          ID: <span className="font-mono">{r.id}</span> · สร้างเมื่อ{" "}
          {formatDateTime(r.created_at)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="เมนู" value={menuCount ?? 0} />
        <Stat label="โต๊ะ" value={tableCount ?? 0} />
        <Stat label="ออเดอร์" value={orderCount ?? 0} />
        <Stat label="ข้อความ" value={feedbackCount ?? 0} />
      </section>

      <AdminRestaurantForm restaurant={r} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}
