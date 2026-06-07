import { supabase } from "@/lib/supabase";
import type { OrderItem } from "@/lib/types";

export async function callStaff({
  restaurantId,
  tableId,
  reason,
}: {
  restaurantId: string;
  tableId: string;
  reason: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase().from("call_staff_requests").insert({
    restaurant_id: restaurantId,
    table_id: tableId,
    reason,
    acknowledged: false,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function placeOrder({
  restaurantId,
  tableId,
  items,
}: {
  restaurantId: string;
  tableId: string;
  items: OrderItem[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: false, error: "EMPTY_CART" };

  const ids = items.map((item) => item.menu_id);
  const { data: menus, error: menuError } = await supabase()
    .from("menus")
    .select("id, price, available")
    .eq("restaurant_id", restaurantId)
    .in("id", ids);

  if (menuError) return { ok: false, error: menuError.message };
  const menuMap = new Map((menus ?? []).map((menu) => [menu.id as string, menu]));
  let total = 0;
  for (const item of items) {
    const menu = menuMap.get(item.menu_id);
    if (!menu || !menu.available) {
      return { ok: false, error: "MENU_UNAVAILABLE" };
    }
    total += Number(menu.price) * item.qty;
  }

  const { error } = await supabase().from("orders").insert({
    restaurant_id: restaurantId,
    table_id: tableId,
    items,
    total,
    status: "pending",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
