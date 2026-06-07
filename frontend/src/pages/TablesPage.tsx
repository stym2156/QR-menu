import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui";
import { supabase } from "../lib/supabase";
import type { DiningTable, TableZone } from "../lib/types";
import TableManager from "../ported/dashboard/tables/TableManager";

export function TablesPage({ restaurantId }: { restaurantId: string }) {
  const [state, setState] = useState<{
    tables: DiningTable[];
    zones: TableZone[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const [tables, zones] = await Promise.all([
        supabase()
          .from("tables")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("table_number"),
        supabase()
          .from("table_zones")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("sort_order"),
      ]);
      if (!cancelled) {
        setState({
          tables: (tables.data ?? []) as DiningTable[],
          zones: (zones.data ?? []) as TableZone[],
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
        title="โต๊ะ & QR Code"
        description="สร้าง QR สำหรับแต่ละโต๊ะ ลูกค้าสแกนเพื่อสั่งอาหาร"
      />
      <TableManager
        restaurantId={restaurantId}
        initialTables={state.tables}
        initialZones={state.zones}
        canManage
        canAct
      />
    </>
  );
}
