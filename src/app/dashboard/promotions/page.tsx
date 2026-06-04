import { redirect } from "next/navigation";
import { isOwner } from "@/lib/membership";
import { requireDashboardSession } from "@/server/auth";
import PromotionManager from "./PromotionManager";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { Promotion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const { supabase, membership } = await requireDashboardSession();
  if (!isOwner(membership.role)) redirect("/dashboard");

  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .eq("restaurant_id", membership.restaurantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div>
      <I18nPageHeader
        titleKey="page.promotions.title"
        descKey="page.promotions.desc"
      />
      <PromotionManager
        restaurantId={membership.restaurantId}
        initialPromotions={(promotions ?? []) as Promotion[]}
      />
    </div>
  );
}
