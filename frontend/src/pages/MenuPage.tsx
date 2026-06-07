import { useEffect, useState } from "react";
import { PageHeader, LinkButton } from "../components/ui";
import { supabase } from "../lib/supabase";
import type { Category, Menu } from "../lib/types";
import MenuManager from "../ported/dashboard/menu/MenuManager";

export function MenuPage({ restaurantId }: { restaurantId: string }) {
  const [state, setState] = useState<{
    menus: Menu[];
    categories: Category[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const [menus, categories] = await Promise.all([
        supabase()
          .from("menus")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false }),
        supabase()
          .from("categories")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("sort_order"),
      ]);
      if (!cancelled) {
        setState({
          menus: (menus.data ?? []) as Menu[],
          categories: (categories.data ?? []) as Category[],
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (!state) {
    return <div className="text-sm text-muted">Loading...</div>;
  }

  return (
    <>
      <PageHeader
        title="เมนู"
        description="เพิ่ม / แก้ไข / ลบรายการอาหาร"
        action={<LinkButton href="/dashboard/categories">จัดการหมวดหมู่</LinkButton>}
      />
      <MenuManager
        restaurantId={restaurantId}
        initialMenus={state.menus}
        categories={state.categories}
        canAct
      />
    </>
  );
}
