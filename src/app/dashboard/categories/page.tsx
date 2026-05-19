import { createClient } from "@/lib/supabase/server";
import CategoryManager from "./CategoryManager";
import { PageHeader } from "@/components/ui";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
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

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div>
      <PageHeader
        title="หมวดหมู่เมนู"
        description="จัดกลุ่มเมนูเป็นหมวด เช่น อาหาร / เครื่องดื่ม / ของหวาน"
      />
      <CategoryManager
        restaurantId={restaurant.id}
        initialCategories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
