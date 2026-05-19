"use server";

import { createClient } from "@/lib/supabase/server";
import { getShopStatus } from "@/lib/hours";
import { rateLimit } from "@/lib/rateLimit";

interface OrderItemInput {
  menu_id: string;
  qty: number;
  note?: string;
}

export interface PlaceOrderInput {
  restaurantId: string;
  tableId: string;
  items: OrderItemInput[];
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; error: string };

const MAX_ITEMS_PER_LINE = 999;
const MAX_LINES = 50;

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  // Anonymous customers can call this; supabase client uses the anon key
  // and goes through RLS. The point of this action is to compute the price
  // and enforce structural invariants server-side instead of trusting the
  // client.
  const supabase = await createClient();

  if (!input.restaurantId || !input.tableId) {
    return { ok: false, error: "ข้อมูลร้านหรือโต๊ะไม่ครบ" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "ไม่มีรายการในตะกร้า" };
  }
  if (input.items.length > MAX_LINES) {
    return { ok: false, error: "มีรายการเยอะเกินไปต่อ 1 ออเดอร์" };
  }

  // Rate limit per table — max 10 orders per minute.
  const rl = rateLimit(`order:${input.tableId}`, {
    max: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return {
      ok: false,
      error: `ส่งออเดอร์ถี่เกินไป กรุณารอ ${rl.retryAfterSec} วินาที`,
    };
  }

  // Verify table belongs to the restaurant.
  const { data: table, error: tableErr } = await supabase
    .from("tables")
    .select("id, restaurant_id")
    .eq("id", input.tableId)
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();

  if (tableErr) return { ok: false, error: tableErr.message };
  if (!table) return { ok: false, error: "ไม่พบโต๊ะนี้ในร้าน" };

  // Check shop is open (accepting orders + within hours).
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("accepting_orders, open_time, close_time")
    .eq("id", input.restaurantId)
    .maybeSingle();

  if (!restaurant) return { ok: false, error: "ไม่พบร้าน" };

  const shopStatus = getShopStatus({
    accepting_orders: restaurant.accepting_orders ?? true,
    open_time: restaurant.open_time ?? null,
    close_time: restaurant.close_time ?? null,
  });
  if (!shopStatus.isOpen) {
    return { ok: false, error: "ร้านปิดอยู่ตอนนี้ ไม่สามารถสั่งได้" };
  }

  // Validate items + recompute total from DB prices (don't trust client).
  const menuIds = Array.from(new Set(input.items.map((i) => i.menu_id)));
  const { data: menus, error: menusErr } = await supabase
    .from("menus")
    .select("id, price, available, restaurant_id")
    .in("id", menuIds);

  if (menusErr) return { ok: false, error: menusErr.message };

  const menuById = new Map((menus ?? []).map((m) => [m.id, m]));

  let total = 0;
  const safeItems: OrderItemInput[] = [];

  for (const item of input.items) {
    const menu = menuById.get(item.menu_id);
    if (!menu) {
      return { ok: false, error: "เมนูบางรายการไม่มีอยู่แล้ว" };
    }
    if (menu.restaurant_id !== input.restaurantId) {
      return { ok: false, error: "เมนูไม่ตรงกับร้าน" };
    }
    if (!menu.available) {
      return { ok: false, error: "เมนูบางรายการถูกปิดการขายแล้ว" };
    }
    const qty = Math.floor(Number(item.qty));
    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_ITEMS_PER_LINE) {
      return { ok: false, error: "จำนวนไม่ถูกต้อง" };
    }
    const price = Number(menu.price);
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "ราคาเมนูไม่ถูกต้อง" };
    }
    total += price * qty;
    const note = typeof item.note === "string" ? item.note.trim().slice(0, 200) : "";
    safeItems.push({
      menu_id: item.menu_id,
      qty,
      ...(note ? { note } : {}),
    });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("orders")
    .insert({
      restaurant_id: input.restaurantId,
      table_id: input.tableId,
      items: safeItems,
      total,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "สั่งไม่สำเร็จ" };
  }

  return { ok: true, orderId: inserted.id, total };
}

export type CallStaffResult =
  | { ok: true }
  | { ok: false; error: string };

export async function callStaff(input: {
  restaurantId: string;
  tableId: string;
  reason: string | null;
}): Promise<CallStaffResult> {
  if (!input.restaurantId || !input.tableId) {
    return { ok: false, error: "ข้อมูลไม่ครบ" };
  }

  // Rate limit per table — max 3 calls per minute.
  const rl = rateLimit(`call:${input.tableId}`, {
    max: 3,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return {
      ok: false,
      error: `เรียกพนักงานถี่เกินไป กรุณารอ ${rl.retryAfterSec} วินาที`,
    };
  }

  const supabase = await createClient();

  // Verify table belongs to restaurant before letting anon insert through RLS.
  const { data: table } = await supabase
    .from("tables")
    .select("id")
    .eq("id", input.tableId)
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();

  if (!table) return { ok: false, error: "ไม่พบโต๊ะนี้ในร้าน" };

  const reason =
    typeof input.reason === "string"
      ? input.reason.trim().slice(0, 200) || null
      : null;

  const { error } = await supabase.from("call_staff_requests").insert({
    restaurant_id: input.restaurantId,
    table_id: input.tableId,
    reason,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
