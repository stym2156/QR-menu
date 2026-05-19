import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerOrder from "./CustomerOrder";
import { getShopStatus } from "@/lib/hours";
import type { Category, Menu, Promotion } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ restaurantId: string; tableId: string }>;

export default async function CustomerMenuPage({ params }: { params: Params }) {
  const { restaurantId, tableId } = await params;
  const supabase = await createClient();

  const [
    { data: table },
    { data: restaurant },
    { data: menus },
    { data: categories },
    { data: promotions },
  ] = await Promise.all([
    supabase
      .from("tables")
      .select("id, table_number, restaurant_id, is_open")
      .eq("id", tableId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    supabase
      .from("restaurants")
      .select("name, accepting_orders, open_time, close_time, service_charge_pct, vat_pct")
      .eq("id", restaurantId)
      .maybeSingle(),
    supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("available", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("promotions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .or(`start_at.is.null,start_at.lte.${new Date().toISOString()}`)
      .or(`end_at.is.null,end_at.gte.${new Date().toISOString()}`)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (!table || !restaurant) notFound();

  const tableIsOpen = (table as { is_open?: boolean }).is_open ?? false;
  const shopStatus = getShopStatus({
    accepting_orders: restaurant.accepting_orders ?? true,
    open_time: restaurant.open_time ?? null,
    close_time: restaurant.close_time ?? null,
  });
  const canOrder = shopStatus.isOpen && tableIsOpen;

  return (
    <main className="min-h-screen bg-canvas pb-36">
      <header className="border-b border-line bg-surface px-5 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink">
              {restaurant.name}
            </h1>
            {shopStatus.openTime && shopStatus.closeTime ? (
              <p className="mt-1 text-xs text-muted">
                เปิด {shopStatus.openTime} – {shopStatus.closeTime} น.
              </p>
            ) : null}
          </div>
          <div className="shrink-0 rounded-xl bg-canvas px-3 py-2 text-right">
            <div className="text-[10px] font-medium  tracking-[0.14em] text-muted">
              Table
            </div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-ink">
              {table.table_number}
            </div>
          </div>
        </div>
      </header>

      {!shopStatus.isOpen ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-6 text-center">
          <div className="mb-1 text-3xl">🌙</div>
          <h2 className="text-base font-semibold tracking-tight text-red-900">
            ร้านปิดอยู่ตอนนี้
          </h2>
          <p className="mt-1 text-sm text-red-700">
            {shopStatus.reason === "manually_closed"
              ? "ร้านหยุดรับออเดอร์ชั่วคราว"
              : shopStatus.openTime && shopStatus.closeTime
                ? `เปิดทำการ ${shopStatus.openTime} – ${shopStatus.closeTime} น.`
                : "กรุณามาใหม่ในเวลาทำการ"}
          </p>
        </div>
      ) : !tableIsOpen ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-6 text-center">
          <div className="mb-1 text-3xl">🔒</div>
          <h2 className="text-base font-semibold tracking-tight text-amber-900">
            โต๊ะนี้ยังไม่เปิดให้สั่ง
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            กรุณาแจ้งพนักงานเพื่อเปิดโต๊ะให้คุณสั่งอาหาร
          </p>
        </div>
      ) : null}

      <CustomerOrder
        restaurantId={restaurantId}
        tableId={tableId}
        tableNumber={table.table_number}
        menus={(menus ?? []) as Menu[]}
        categories={(categories ?? []) as Category[]}
        promotions={(promotions ?? []) as Promotion[]}
        shopOpen={canOrder}
        serviceChargePct={Number(restaurant.service_charge_pct) || 0}
        vatPct={Number(restaurant.vat_pct) || 0}
      />
    </main>
  );
}
