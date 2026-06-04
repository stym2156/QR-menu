import { redirect } from "next/navigation";
import {
  canActTables,
  canManageTables,
  canSeeTables,
} from "@/lib/membership";
import { requireDashboardSession } from "@/server/auth";
import TableManager from "./TableManager";
import I18nPageHeader from "@/components/I18nPageHeader";
import type { DiningTable, TableZone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { supabase, membership } = await requireDashboardSession();
  if (!canSeeTables(membership.role)) redirect("/dashboard");

  const [{ data: tables }, { data: zones }] = await Promise.all([
    supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .order("table_number", { ascending: true }),
    supabase
      .from("table_zones")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

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
        initialZones={(zones ?? []) as TableZone[]}
        canManage={canManageTables(membership.role)}
        canAct={canActTables(membership.role)}
      />
    </div>
  );
}
