import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership, isOwner } from "@/lib/membership";
import CategoryManager from "./CategoryManager";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }
  if (!isOwner(membership.role)) redirect("/dashboard");

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", membership.restaurantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div>
      <I18nPageHeader
        titleKey="page.categories.title"
        descKey="page.categories.desc"
      />
      <CategoryManager
        restaurantId={membership.restaurantId}
        initialCategories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
