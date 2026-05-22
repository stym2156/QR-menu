import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership, isOwner } from "@/lib/membership";
import PromotionManager from "./PromotionManager";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { Promotion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
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
