import { createClient } from "@/lib/supabase/server";
import PromotionManager from "./PromotionManager";
import { PageHeader } from "@/components/ui";
import type { Promotion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
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

  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="โปรโมชัน"
        description="แสดงบนหน้าลูกค้า · เปิด/ปิดได้ตลอด · เก็บไว้ใช้รอบหน้าได้"
      />
      <PromotionManager
        restaurantId={restaurant.id}
        initialPromotions={(promotions ?? []) as Promotion[]}
      />
    </div>
  );
}
