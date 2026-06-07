import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui";
import { supabase } from "../lib/supabase";
import type { Category } from "../lib/types";
import CategoryManager from "../ported/dashboard/categories/CategoryManager";

export function CategoriesPage({ restaurantId }: { restaurantId: string }) {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase()
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .then(({ data }) => {
        if (!cancelled) setCategories((data ?? []) as Category[]);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (!categories) {
    return <div className="text-sm text-muted">Loading...</div>;
  }

  return (
    <>
      <PageHeader
        title="หมวดหมู่เมนู"
        description="จัดกลุ่มเมนูเป็นหมวด เช่น อาหาร / เครื่องดื่ม / ของหวาน"
      />
      <CategoryManager restaurantId={restaurantId} initialCategories={categories} />
    </>
  );
}
