import { useEffect, useState } from "react";
import I18nPageHeader from "../../components/I18nPageHeader";
import { PROMOTION_SELECT } from "../../lib/db/selects";
import { supabase } from "../../lib/supabase";
import type { Promotion } from "../../lib/types";
import PromotionManager from "../../ported/dashboard/promotions/PromotionManager";

export function PromotionsPage({ restaurantId }: { restaurantId: string }) {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const { data } = await supabase()
        .from("promotions")
        .select(PROMOTION_SELECT)
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (!cancelled) setPromotions((data ?? []) as Promotion[]);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return (
    <div>
      <I18nPageHeader titleKey="page.promotions.title" descKey="page.promotions.desc" />
      {promotions ? (
        <PromotionManager restaurantId={restaurantId} initialPromotions={promotions} />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
          Loading promotions...
        </div>
      )}
    </div>
  );
}

