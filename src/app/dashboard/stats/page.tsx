import { createClient } from "@/lib/supabase/server";
import StatsView from "./StatsView";
import { PageHeader } from "@/components/ui";
import type { Menu, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
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

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: orders }, { data: menus }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("paid", true)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("menus").select("*").eq("restaurant_id", restaurant.id),
  ]);

  return (
    <div>
      
      <StatsView
        orders={(orders ?? []) as Order[]}
        menus={(menus ?? []) as Menu[]}
      />
    </div>
  );
}
