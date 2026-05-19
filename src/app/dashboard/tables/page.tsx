import { createClient } from "@/lib/supabase/server";
import TableManager from "./TableManager";
import { PageHeader } from "@/components/ui";
import type { DiningTable } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
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

  const { data: tables } = await supabase
    .from("tables")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("table_number", { ascending: true });

  return (
    <div>
      <PageHeader
        title="โต๊ะ & QR Code"
        description="สร้าง QR สำหรับแต่ละโต๊ะ ลูกค้าสแกนเพื่อสั่งอาหาร"
      />
      <TableManager
        restaurantId={restaurant.id}
        initialTables={(tables ?? []) as DiningTable[]}
      />
    </div>
  );
}
