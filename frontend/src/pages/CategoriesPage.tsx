import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui";
import { useT } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase";
import type { Category } from "../lib/types";
import CategoryManager from "../ported/dashboard/categories/CategoryManager";

export function CategoriesPage({ restaurantId }: { restaurantId: string }) {
  const { t } = useT();
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
    return <div className="text-sm text-muted">{t("common.loading")}</div>;
  }

  return (
    <>
      <PageHeader title={t("page.categories.title")} description={t("page.categories.desc")} />
      <CategoryManager restaurantId={restaurantId} initialCategories={categories} />
    </>
  );
}
