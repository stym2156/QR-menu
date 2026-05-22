"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import CustomerOrder from "@/app/menu/[restaurantId]/[tableId]/CustomerOrder";
import type {
  Category,
  DiningTable,
  Menu,
  Promotion,
} from "@/lib/types";

interface Props {
  restaurantId: string;
  tables: DiningTable[];
  menus: Menu[];
  categories: Category[];
  promotions: Promotion[];
  shopOpen: boolean;
  serviceChargePct: number;
  vatPct: number;
}

/**
 * Waiter-side "order for customer" helper. Reuses the same CustomerOrder UI
 * the diner sees on their phone, with a table picker at the top so the
 * waiter can switch between tables. Used when the customer's phone can't
 * scan the QR (no signal, dead battery, etc.) — waiter helps from their
 * own phone.
 *
 * Only tables that are currently OPEN are pickable — placeOrder validates
 * is_open on the server, so picking a closed table would just fail.
 */
export default function StaffOrderHelper({
  restaurantId,
  tables,
  menus,
  categories,
  promotions,
  shopOpen,
  serviceChargePct,
  vatPct,
}: Props) {
  const { t } = useT();
  const openTables = tables.filter((tb) => tb.is_open);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    openTables[0]?.id ?? null,
  );

  const selectedTable = openTables.find((tb) => tb.id === selectedTableId);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              {t("staff_order.pick_table")}
            </h2>
            <span className="text-[11px] text-muted">
              {t("staff_order.open_tables_n", { n: openTables.length })}
            </span>
          </div>

          {openTables.length === 0 ? (
            <p className="text-xs text-muted">{t("staff_order.no_open_tables")}</p>
          ) : (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {openTables.map((tb) => {
                const active = selectedTableId === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setSelectedTableId(tb.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                      active
                        ? "border-ink bg-ink text-surface"
                        : "border-line bg-surface text-ink hover:border-ink/30"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface/20 text-[10px] font-bold tabular-nums">
                      {tb.table_number}
                    </span>
                    {t("staff_order.table_label", { n: tb.table_number })}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedTable ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {/* Re-key by tableId so the cart + subscriptions reset on switch. */}
          <CustomerOrder
            key={selectedTable.id}
            restaurantId={restaurantId}
            tableId={selectedTable.id}
            tableNumber={selectedTable.table_number}
            menus={menus}
            categories={categories}
            promotions={promotions}
            shopOpen={shopOpen}
            serviceChargePct={serviceChargePct}
            vatPct={vatPct}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center text-sm text-muted">
          {t("staff_order.empty")}
        </div>
      )}
    </div>
  );
}
