import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { createClient } from "@/lib/supabase/server";
import {
  canActTables,
  canManageTables,
  canSeeTables,
  getCurrentMembership,
} from "@/lib/membership";
import TableManager from "./TableManager";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { DiningTable } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }
  if (!canSeeTables(membership.role)) redirect("/dashboard");

  const { data: tables } = await supabase
    .from("tables")
    .select("*")
    .eq("restaurant_id", membership.restaurantId)
    .order("table_number", { ascending: true });

  return (
    <div>
      <I18nPageHeader
        titleKey="page.tables.title"
        descKey={
          canManageTables(membership.role)
            ? "page.tables.desc.owner"
            : "page.tables.desc.waiter"
        }
      />
      <TableManager
        restaurantId={membership.restaurantId}
        initialTables={(tables ?? []) as DiningTable[]}
        canManage={canManageTables(membership.role)}
        canAct={canActTables(membership.role)}
      />
    </div>
  );
}
