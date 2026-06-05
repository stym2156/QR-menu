import { redirect } from "next/navigation";
import { CATEGORY_SELECT } from "@/lib/db/selects";
import { isOwner } from "@/lib/membership";
import { requireDashboardSession } from "@/server/auth";
import CategoryManager from "./CategoryManager";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { supabase, membership } = await requireDashboardSession();
  if (!isOwner(membership.role)) redirect("/dashboard");

  const { data: categories } = await supabase
    .from("categories")
    .select(CATEGORY_SELECT)
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
