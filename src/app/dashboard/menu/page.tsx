import { createClient } from "@/lib/supabase/server";
import MenuManager from "./MenuManager";
import { PageHeader, LinkButton } from "@/components/ui";
import type { Category, Menu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!restaurant) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }

  const [{ data: menus }, { data: categories }] = await Promise.all([
    supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="เมนู"
        description="เพิ่ม / แก้ไข / ลบรายการอาหาร"
        action={<LinkButton href="/dashboard/categories">จัดการหมวดหมู่</LinkButton>}
      />
      <MenuManager
        restaurantId={restaurant.id}
        initialMenus={(menus ?? []) as Menu[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
